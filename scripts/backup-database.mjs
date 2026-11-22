#!/usr/bin/env node
// Nightly database backup to Cloudinary, kept as private files (no public link) under <folder>/backups/.
// Standalone on purpose: it uses only Node and pg_dump, so it keeps working whatever release is deployed.
//
//   node scripts/backup-database.mjs                 back up now and keep the newest BACKUP_KEEP (default 14)
//   node scripts/backup-database.mjs --list          list stored backups
//   node scripts/backup-database.mjs --download NAME save a backup to the current folder (for pg_restore)
//   node scripts/backup-database.mjs --from-file F   upload an existing dump instead of running pg_dump (testing)
//
// Reads DATABASE_URL, CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET), CLOUDINARY_FOLDER and BACKUP_KEEP.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Cloudinary's raw-file limit on the free plan. A larger dump fails loudly instead of being silently skipped.
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/** @param {Record<string, string | undefined>} env */
export function config(env = process.env) {
  const url = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const [apiKey, apiSecret, cloudName] = url ? [url[1], url[2], url[3]] : [env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME];
  if (!apiKey || !apiSecret || !cloudName) throw new Error("Set CLOUDINARY_URL (or the three CLOUDINARY_* values) to store backups");
  const folder = env.CLOUDINARY_FOLDER || "kbo";
  if (!/^[a-z0-9_-]{1,40}$/.test(folder)) throw new Error("CLOUDINARY_FOLDER may only use lowercase letters, digits, - and _");
  const keep = Number(env.BACKUP_KEEP || 14);
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) throw new Error("BACKUP_KEEP must be a whole number from 1 to 365");
  return { cloudName, apiKey, apiSecret, folder, keep, prefix: `${folder}/backups/` };
}

export function signParams(params, secret) {
  const query = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(query + secret).digest("hex");
}
const signed = (c, params) => {
  const all = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  return { ...all, api_key: c.apiKey, signature: signParams(all, c.apiSecret) };
};
const api = c => `https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloudName)}`;
async function check(response, action) {
  if (response.ok) return response;
  const detail = await response.text().catch(() => "");
  throw new Error(`Cloudinary ${action} failed (${response.status}): ${detail.slice(0, 200)}`);
}

// Backup names sort by time: db-2026-11-22T02-30-00Z.
export const backupName = (date = new Date()) => `db-${date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-")}`;

export async function upload(c, name, bytes, request = fetch) {
  if (bytes.length > MAX_BACKUP_BYTES) throw new Error(`The backup is ${(bytes.length / 1048576).toFixed(1)} MB, over Cloudinary's ${MAX_BACKUP_BYTES / 1048576} MB limit for this plan. Upgrade the plan or move backups to other storage.`);
  const body = new FormData();
  for (const [key, value] of Object.entries(signed(c, { public_id: c.prefix + name, type: "private", overwrite: "false" }))) body.set(key, value);
  // No file name: Cloudinary would add its extension to the stored name.
  body.set("file", new Blob([new Uint8Array(bytes)]));
  const data = await (await check(await request(`${api(c)}/raw/upload`, { method: "POST", body }), "upload")).json();
  if (data.bytes !== bytes.length) throw new Error("Cloudinary stored a different size than was sent");
  return data;
}

export async function list(c, request = fetch) {
  const found = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ type: "private", prefix: c.prefix, max_results: "500", ...(cursor ? { next_cursor: cursor } : {}) });
    const data = await (await check(await request(`${api(c)}/resources/raw?${query}`, { headers: { Authorization: `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString("base64")}` } }), "list")).json();
    found.push(...data.resources.map(item => ({ name: item.public_id.slice(c.prefix.length), bytes: item.bytes, createdAt: item.created_at })));
    cursor = data.next_cursor ?? "";
  } while (cursor);
  return found.filter(item => item.name.startsWith("db-")).sort((a, b) => b.name.localeCompare(a.name));
}

export async function remove(c, name, request = fetch) {
  const body = new FormData();
  for (const [key, value] of Object.entries(signed(c, { public_id: c.prefix + name, type: "private", invalidate: "true" }))) body.set(key, value);
  const data = await (await check(await request(`${api(c)}/raw/destroy`, { method: "POST", body }), "delete")).json();
  if (data.result !== "ok" && data.result !== "not found") throw new Error(`Cloudinary could not delete ${name}`);
}

export async function download(c, name, request = fetch) {
  if (!/^db-[0-9TZ-]+$/.test(name)) throw new Error("Give a backup name from --list, e.g. db-2026-11-22T02-30-00Z");
  const query = new URLSearchParams(signed(c, { public_id: c.prefix + name, type: "private", expires_at: String(Math.floor(Date.now() / 1000) + 300) }));
  return Buffer.from(await (await check(await request(`${api(c)}/raw/download?${query}`), "download")).arrayBuffer());
}

// Keeps the newest `keep` backups. Never deletes the one just made, even if the clock is off.
export async function prune(c, justMade, request = fetch) {
  const backups = await list(c, request);
  const old = backups.filter(item => !item.name.startsWith(justMade)).slice(Math.max(0, c.keep - 1));
  for (const item of old) await remove(c, item.name, request);
  return old.map(item => item.name);
}

function pgDump(databaseUrl, file) {
  if (!databaseUrl) throw new Error("Set DATABASE_URL to back up the database");
  const url = new URL(databaseUrl);
  // The password goes through the environment, never the command line, so it can't show up in process lists.
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  url.password = "";
  url.searchParams.delete("schema");
  return new Promise((resolve, reject) => execFile("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`, `--dbname=${url}`], { env, timeout: 15 * 60 * 1000 }, error => error ? reject(new Error(`pg_dump failed: ${error.message}`)) : resolve()));
}

async function main(args) {
  const c = config();
  if (args[0] === "--list") {
    const backups = await list(c);
    if (!backups.length) console.log("No backups yet.");
    for (const item of backups) console.log(`${item.name}  ${(item.bytes / 1024).toFixed(0).padStart(7)} KB  ${item.createdAt}`);
    return;
  }
  if (args[0] === "--download") {
    const bytes = await download(c, args[1] ?? "");
    await writeFile(`${args[1]}.dump`, bytes, { mode: 0o600 });
    console.log(`Saved ${args[1]}.dump (${(bytes.length / 1024).toFixed(0)} KB). Restore with: pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" ${args[1]}.dump`);
    return;
  }
  const name = backupName();
  const work = await mkdtemp(path.join(tmpdir(), "kbo-backup-"));
  try {
    const file = args[0] === "--from-file" ? args[1] : path.join(work, `${name}.dump`);
    if (args[0] !== "--from-file") await pgDump(process.env.DATABASE_URL, file);
    const bytes = await readFile(file);
    await upload(c, name, bytes);
    const removed = await prune(c, name);
    console.log(JSON.stringify({ event: "backup.completed", name, kilobytes: Math.round(bytes.length / 1024), removed }));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch(error => { console.error(JSON.stringify({ event: "backup.failed", message: error.message })); process.exit(1); });
}
