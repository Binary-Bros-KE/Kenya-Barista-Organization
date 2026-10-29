import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { AccessError } from "./errors";

export const MAX_CV_BYTES = 5 * 1024 * 1024;
// These are runtime uploads, never assets to include in a deployment bundle.
export async function readStoredCv(key: string) { return readFile(/* turbopackIgnore: true */ filePath(key)); }
function storageRoot() {
  const configured = process.env.PRIVATE_UPLOAD_DIR;
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) throw new Error("Configure an absolute PRIVATE_UPLOAD_DIR outside the web root");
  const root = path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".private-uploads"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(publicRoot + path.sep)) throw new Error("Uploads must be outside public");
  return root;
}
function filePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return path.join(/* turbopackIgnore: true */ storageRoot(), key);
}
export function validatePdf(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_CV_BYTES) throw new AccessError(413, "INVALID_SIZE", "Upload a PDF up to 5 MB");
  const data = Buffer.from(bytes);
  // Format screening is not a malware scan. New files stay quarantined as PENDING.
  if (!data.subarray(0, 8).toString("ascii").match(/^%PDF-\d\.\d/) || !data.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new AccessError(400, "PDF_REQUIRED", "Upload a valid PDF CV");
}
export async function uploadCv(db: PrismaClient, actor: Actor, bytes: Uint8Array, filename: string) {
  validatePdf(bytes);
  const safeName = filename.replace(/[^a-zA-Z0-9 ._-]/g, "_").slice(0, 100).replace(/^\.+/, "") || "cv.pdf";
  // Serialize uploads per account, limiting storage even under concurrent requests.
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
    if (await tx.document.count({ where: { userId: actor.user.id } }) >= 5) throw new AccessError(409, "CV_LIMIT", "You can store up to five CVs. Remove an unused CV first");
    const key = randomUUID();
    await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
    await writeFile(filePath(key), bytes, { flag: "wx", mode: 0o600 });
    try { return await tx.document.create({ data: { userId: actor.user.id, storageKey: key, filename: safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`, mimeType: "application/pdf", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, select: { id: true, filename: true, scanStatus: true } }); }
    catch (error) { await unlink(filePath(key)).catch(() => {}); throw error; }
  }, { timeout: 15000 });
}
export async function downloadCv(db: PrismaClient, actor: Actor, id: string) {
  const doc = await db.document.findFirst({ where: { id, userId: actor.user.id, scanStatus: { in: ["PENDING", "CLEAN"] } } });
  if (!doc) throw new AccessError(404, "NOT_FOUND", "CV not found");
  return { document: doc, bytes: await readFile(/* turbopackIgnore: true */ filePath(doc.storageKey)) };
}
export async function deleteCv(db: PrismaClient, actor: Actor, id: string) {
  const doc = await db.document.findFirst({ where: { id, userId: actor.user.id } });
  if (!doc) throw new AccessError(404, "NOT_FOUND", "CV not found");
  if (await db.applicationDocument.count({ where: { documentId: id } })) throw new AccessError(409, "CV_IN_USE", "Remove this CV from your draft applications before deleting it");
  try { await db.document.delete({ where: { id } }); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2003") throw new AccessError(409, "CV_IN_USE", "This CV is attached to an application"); throw error; }
  // Metadata removal revokes access immediately. A missing file is already deleted.
  await unlink(filePath(doc.storageKey)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  return { deleted: true };
}
