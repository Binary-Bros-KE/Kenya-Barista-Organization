import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") throw new Error("Development mailbox is unavailable in production");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--email") throw new Error("Usage: npm.cmd run mail:preview -- --email your-email@example.com");
const directory = fileURLToPath(new URL("../.dev-mail/", import.meta.url));
let files;
try { files = (await readdir(directory)).filter(name => name.endsWith(".json")).sort().reverse(); }
catch (error) { if (error.code !== "ENOENT") throw error; files = []; }
let count = 0;
for (const file of files) {
  const message = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  if (message.to.toLowerCase() !== args[1].toLowerCase()) continue;
  console.log(`\n${message.createdAt} — ${message.subject}\n${message.text}\n`);
  if (++count === 5) break;
}
if (!count) console.log("No development emails found for that address.");
