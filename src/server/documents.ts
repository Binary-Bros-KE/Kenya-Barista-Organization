import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { getEnv } from "../lib/env";
import { logEvent } from "../lib/logger";
import type { Actor } from "./access";
import { cloudinaryConfig, privateFiles, type CloudinaryConfig, type PrivateFiles } from "./cloudinary";
import { AccessError } from "./errors";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

// CV files live either on the server's disk or as private Cloudinary files (no public link; only the
// server can fetch them). Each Document row records where its file is, so reads and deletes always
// follow the row; CV_STORAGE only decides where new uploads go.
export type CvStorage = "disk" | "cloudinary";
export type CvStore = { kind: CvStorage; put(key: string, bytes: Buffer): Promise<void>; get(key: string): Promise<Buffer>; remove(key: string): Promise<void> };
const missing = () => new AccessError(404, "CV_UNAVAILABLE", "This CV file is missing");

function storageRoot() {
  const configured = process.env.PRIVATE_UPLOAD_DIR;
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) throw new Error("Configure an absolute PRIVATE_UPLOAD_DIR outside the web root");
  const root = path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".private-uploads"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(publicRoot + path.sep)) throw new Error("Uploads must be outside public");
  return root;
}
function checkKey(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return key;
}
// These are runtime uploads, never assets to include in a deployment bundle.
const filePath = (key: string) => path.join(/* turbopackIgnore: true */ storageRoot(), checkKey(key));
export const diskCvStore: CvStore = {
  kind: "disk",
  async put(key, bytes) { await mkdir(storageRoot(), { recursive: true, mode: 0o700 }); await writeFile(filePath(key), bytes, { flag: "wx", mode: 0o600 }); },
  async get(key) { return readFile(/* turbopackIgnore: true */ filePath(key)).catch((error: NodeJS.ErrnoException) => { throw error.code === "ENOENT" ? missing() : error; }); },
  async remove(key) { await unlink(filePath(key)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); },
};
export function cloudinaryCvStore(config: CloudinaryConfig, files: PrivateFiles = privateFiles(config)): CvStore {
  const id = (key: string) => `${config.folder}/cvs/${checkKey(key)}`;
  return {
    kind: "cloudinary",
    put: async (key, bytes) => files.put(id(key), bytes),
    get: async key => files.get(id(key)).catch((error: { missing?: boolean }) => { throw error.missing ? missing() : error; }),
    remove: async key => files.remove(id(key)),
  };
}
export function cvStore(kind: string): CvStore {
  if (kind === "disk") return diskCvStore;
  const config = cloudinaryConfig();
  if (kind === "cloudinary" && config) return cloudinaryCvStore(config);
  throw new AccessError(503, "CV_STORAGE_UNAVAILABLE", "CVs are unavailable right now. Please try again later.");
}
export const newCvStore = () => cvStore(getEnv().CV_STORAGE);
export async function readStoredCv(document: { storageKey: string; storage: string }) { return cvStore(document.storage).get(document.storageKey); }

export function validatePdf(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_CV_BYTES) throw new AccessError(413, "INVALID_SIZE", "Upload a PDF up to 5 MB");
  const data = Buffer.from(bytes);
  // Format screening is not a malware scan. New files stay quarantined as PENDING.
  if (!data.subarray(0, 8).toString("ascii").match(/^%PDF-\d\.\d/) || !data.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new AccessError(400, "PDF_REQUIRED", "Upload a valid PDF CV");
}
// Drafts whose payment has started are frozen, so they keep the CV they had.
const lockedPayments = ["PENDING", "NEEDS_REVIEW", "SUCCEEDED", "REFUNDED"];

// Each account has one CV. Uploading a new one replaces it: editable drafts move to the new CV, and the old
// CV is deleted, unless applications that were already sent (or are waiting on payment) still use it. Then it's
// retired: hidden from its owner, but kept so recruiters get exactly the CV that was submitted.
export async function uploadCv(db: PrismaClient, actor: Actor, bytes: Uint8Array, filename: string, store: CvStore = newCvStore()) {
  validatePdf(bytes);
  const safeName = filename.replace(/[^a-zA-Z0-9 ._-]/g, "_").slice(0, 100).replace(/^\.+/, "") || "cv.pdf";
  // The file is stored before the database row, outside the transaction, so a slow upload never holds a
  // database lock. If the row can't be created, the file is removed again.
  const key = randomUUID();
  await store.put(key, Buffer.from(bytes));
  const deleted: { storageKey: string; storage: string }[] = [];
  try {
    const result = await db.$transaction(async tx => {
      // Serialize uploads per account, so two at once still leave exactly one current CV.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
      const current = await tx.document.findMany({ where: { userId: actor.user.id, retiredAt: null }, select: { id: true, storageKey: true, storage: true } });
      // Retire first: the database allows only one current CV per account.
      if (current.length) await tx.document.updateMany({ where: { id: { in: current.map(doc => doc.id) } }, data: { retiredAt: new Date() } });
      const created = await tx.document.create({ data: { userId: actor.user.id, storageKey: key, storage: store.kind, filename: safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`, mimeType: "application/pdf", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, select: { id: true, filename: true, scanStatus: true } });
      let movedDrafts = 0;
      for (const old of current) {
        const drafts = await tx.applicationDocument.findMany({ where: { documentId: old.id, application: { status: "DRAFT", OR: [{ paymentOrder: { is: null } }, { paymentOrder: { is: { reviewHold: false, status: { notIn: lockedPayments as never } } } }] } }, select: { applicationId: true } });
        const ids = drafts.map(draft => draft.applicationId);
        if (ids.length) {
          await tx.applicationDocument.deleteMany({ where: { documentId: old.id, applicationId: { in: ids } } });
          await tx.applicationDocument.createMany({ data: ids.map(applicationId => ({ applicationId, documentId: created.id })) });
          // A new version makes any open draft editor reload instead of saving the old CV back.
          await tx.application.updateMany({ where: { id: { in: ids } }, data: { version: { increment: 1 } } });
          movedDrafts += ids.length;
        }
        if (!await tx.applicationDocument.count({ where: { documentId: old.id } })) { await tx.document.delete({ where: { id: old.id } }); deleted.push(old); }
      }
      if (current.length) await tx.auditLog.create({ data: { actorId: actor.user.id, action: "cv.replaced", entityType: "Document", entityId: created.id } });
      return { ...created, replaced: current.length > 0, movedDrafts };
    }, { timeout: 15000 });
    // The replaced files are removed once the database no longer points at them.
    for (const old of deleted) await (old.storage === store.kind ? store : cvStore(old.storage)).remove(old.storageKey).catch(() => logEvent("warn", `cv.file_remove_failed.${old.storage}`));
    return result;
  } catch (error) { await store.remove(key).catch(() => {}); throw error; }
}
export async function downloadCv(db: PrismaClient, actor: Actor, id: string) {
  const doc = await db.document.findFirst({ where: { id, userId: actor.user.id, scanStatus: { in: ["PENDING", "CLEAN"] } } });
  if (!doc) throw new AccessError(404, "NOT_FOUND", "CV not found");
  return { document: doc, bytes: await readStoredCv(doc) };
}
export async function deleteCv(db: PrismaClient, actor: Actor, id: string) {
  const doc = await db.document.findFirst({ where: { id, userId: actor.user.id, retiredAt: null } });
  if (!doc) throw new AccessError(404, "NOT_FOUND", "CV not found");
  if (await db.applicationDocument.count({ where: { documentId: id } })) throw new AccessError(409, "CV_IN_USE", "Remove this CV from your draft applications before deleting it");
  try { await db.document.delete({ where: { id } }); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2003") throw new AccessError(409, "CV_IN_USE", "This CV is attached to an application"); throw error; }
  // Metadata removal revokes access immediately. A missing file is already deleted; if the file service is
  // briefly unreachable, the orphaned private file is logged for clean-up rather than failing the request.
  await cvStore(doc.storage).remove(doc.storageKey).catch(() => logEvent("warn", `cv.file_remove_failed.${doc.storage}`));
  return { deleted: true };
}
