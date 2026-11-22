import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BACKUP_BYTES, backupName, config, prune, signParams, upload } from "../scripts/backup-database.mjs";
import { signParams as appSignParams } from "../src/server/cloudinary";

test("backup settings come from the same Cloudinary values as the app", () => {
  const c = config({ CLOUDINARY_URL: "cloudinary://123:s3cret@democloud", CLOUDINARY_FOLDER: "kbo" });
  assert.deepEqual(c, { cloudName: "democloud", apiKey: "123", apiSecret: "s3cret", folder: "kbo", keep: 14, prefix: "kbo/backups/" });
  assert.equal(config({ CLOUDINARY_URL: "cloudinary://1:2@c", BACKUP_KEEP: "30" }).keep, 30);
  assert.throws(() => config({}), /CLOUDINARY_URL/);
  assert.throws(() => config({ CLOUDINARY_URL: "cloudinary://1:2@c", BACKUP_KEEP: "0" }), /BACKUP_KEEP/);
  assert.throws(() => config({ CLOUDINARY_URL: "cloudinary://1:2@c", CLOUDINARY_FOLDER: "../x" }), /CLOUDINARY_FOLDER/);
  assert.equal(signParams({ a: "1", b: "2" }, "x"), appSignParams({ a: "1", b: "2" }, "x"), "Signed exactly like the app");
});

test("backup names sort by time", () => {
  assert.equal(backupName(new Date("2026-11-22T02:30:05.123Z")), "db-2026-11-22T02-30-05Z");
  assert.ok(backupName(new Date("2026-12-01T00:00:00Z")) > backupName(new Date("2026-11-30T23:59:59Z")));
});

test("only the newest backups are kept, never the one just made, and oversized dumps fail loudly", async () => {
  const c = config({ CLOUDINARY_URL: "cloudinary://1:2@c", BACKUP_KEEP: "3" });
  const names = ["db-2026-11-18T02-30-00Z", "db-2026-11-19T02-30-00Z", "db-2026-11-20T02-30-00Z", "db-2026-11-21T02-30-00Z", "db-2026-11-22T02-30-00Z"];
  const deleted: string[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    if (url.includes("/resources/raw")) return Response.json({ resources: names.map(name => ({ public_id: `kbo/backups/${name}`, bytes: 10, created_at: "" })).concat([{ public_id: "kbo/backups/notes.txt", bytes: 1, created_at: "" }]) });
    deleted.push(String((init!.body as FormData).get("public_id")));
    return Response.json({ result: "ok" });
  }) as typeof fetch;
  const removed = await prune(c, "db-2026-11-22T02-30-00Z", fake);
  assert.deepEqual(removed, ["db-2026-11-19T02-30-00Z", "db-2026-11-18T02-30-00Z"]);
  assert.deepEqual(deleted, ["kbo/backups/db-2026-11-19T02-30-00Z", "kbo/backups/db-2026-11-18T02-30-00Z"], "Other files in the folder are left alone");
  await assert.rejects(upload(c, "db-x", Buffer.alloc(MAX_BACKUP_BYTES + 1), fake), /over Cloudinary/);
});
