import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { cloudinaryCvStore, cvStore, readStoredCv, uploadCv, type CvStore } from "../src/server/documents";
import type { PrivateFiles } from "../src/server/cloudinary";

const pdf = Buffer.from("%PDF-1.7\nCV fixture\n%%EOF");
const key = "0f8fad5b-d9cb-469f-a165-70867728950e";
// An in-memory stand-in for Cloudinary's private files.
function fakeFiles() {
  const stored = new Map<string, Buffer>();
  const files: PrivateFiles = {
    async put(id, bytes) { stored.set(id, bytes); },
    async get(id) { const bytes = stored.get(id); if (!bytes) throw Object.assign(new Error("gone"), { missing: true }); return bytes; },
    async remove(id) { stored.delete(id); },
    async list(prefix) { return [...stored.keys()].filter(id => id.startsWith(prefix)).map(publicId => ({ publicId, createdAt: "", bytes: 0 })); },
  };
  return { stored, files };
}

test("CVs in Cloudinary are private files under <folder>/cvs and missing files are reported clearly", async () => {
  const { stored, files } = fakeFiles();
  const store = cloudinaryCvStore({ cloudName: "c", apiKey: "k", apiSecret: "s", folder: "kbo" }, files);
  assert.equal(store.kind, "cloudinary");
  await store.put(key, pdf);
  assert.ok(stored.has(`kbo/cvs/${key}`));
  assert.ok((await store.get(key)).equals(pdf));
  await store.remove(key);
  await assert.rejects(store.get(key), { code: "CV_UNAVAILABLE" });
  await assert.rejects(store.put("../escape", pdf), /Invalid storage key/, "Keys can't leave the folder");
});

test("reads follow where each CV was saved, whatever new uploads use", () => {
  assert.equal(cvStore("disk").kind, "disk");
  const saved = process.env.CLOUDINARY_URL;
  process.env.CLOUDINARY_URL = "";
  try { assert.throws(() => cvStore("cloudinary"), { code: "CV_STORAGE_UNAVAILABLE" }, "No silent fallback to disk for Cloudinary CVs"); }
  finally { process.env.CLOUDINARY_URL = saved; }
  assert.throws(() => cvStore("ftp"), { code: "CV_STORAGE_UNAVAILABLE" });
});

test("CV uploads use the right store, replace the previous CV and clean up after failures", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const user = await db.user.create({ data: { name: "CV Store", email: `cv-store-${randomUUID().slice(0, 8)}@example.invalid`, emailVerified: true } });
  const actor: Actor = { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
  const { stored, files } = fakeFiles();
  const store = cloudinaryCvStore({ cloudName: "c", apiKey: "k", apiSecret: "s", folder: "kbo-test" }, files);
  try {
    const cv = await uploadCv(db, actor, pdf, "My CV.pdf", store);
    const row = await db.document.findUniqueOrThrow({ where: { id: cv.id } });
    assert.equal(row.storage, "cloudinary"); assert.ok(stored.has(`kbo-test/cvs/${row.storageKey}`));
    // The file is in the store the row names.
    assert.ok((await store.get(row.storageKey)).equals(pdf));
    await assert.rejects(readStoredCv({ storageKey: row.storageKey, storage: "disk" }), { code: "CV_UNAVAILABLE" }, "A Cloudinary CV is not looked for on disk");

    // A second upload replaces the first: the old file is deleted from Cloudinary because nothing uses it.
    const second = await uploadCv(db, actor, pdf, "Newer CV.pdf", store);
    assert.equal(second.replaced, true);
    assert.ok(!stored.has(`kbo-test/cvs/${row.storageKey}`), "The replaced file is removed");
    assert.equal(stored.size, 1);

    // If the database step fails after the file is stored, the new file is removed and the current CV is untouched.
    const failing: CvStore = { ...store, put: async (k, bytes) => { await store.put(k, bytes); await db.document.create({ data: { userId: user.id, storageKey: k, storage: "cloudinary", filename: "clash.pdf", mimeType: "application/pdf", sizeBytes: 1, retiredAt: new Date() } }); } };
    await assert.rejects(uploadCv(db, actor, pdf, "late.pdf", failing));
    assert.equal(stored.size, 1, "The orphaned upload was cleaned up");
    assert.equal((await db.document.findFirstOrThrow({ where: { userId: user.id, retiredAt: null } })).id, second.id);
  } finally {
    await db.document.deleteMany({ where: { userId: user.id } });
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
