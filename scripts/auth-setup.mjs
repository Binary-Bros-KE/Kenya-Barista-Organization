import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../.env", import.meta.url);
let content;
try { content = await readFile(path, "utf8"); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  content = await readFile(new URL("../.env.example", import.meta.url), "utf8");
}
if (/^AUTH_SECRET\s*=\s*["']?[^\s"']{32,}/m.test(content)) {
  console.log("Authentication secret is already configured; left unchanged.");
} else {
  const line = `AUTH_SECRET=${randomBytes(48).toString("base64url")}`;
  content = /^AUTH_SECRET\s*=.*$/m.test(content) ? content.replace(/^AUTH_SECRET\s*=.*$/m, line) : content.trimEnd() + "\n" + line + "\n";
  await writeFile(path, content, { mode: 0o600 });
  console.log("Generated a local authentication secret in ignored .env. Its value was not printed.");
}
