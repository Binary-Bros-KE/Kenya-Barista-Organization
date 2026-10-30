
/* Run from the repository root after adding original legacy photos. Requires npm ci. */
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
async function main() {
  const root = process.cwd(), output = path.join(root, "public/optimized"), manifest = {};
  fs.mkdirSync(output, { recursive: true });
  for (const name of fs.readdirSync(path.join(root, "public/legacy")).sort()) {
    if (!/\.(jpe?g|png)$/i.test(name)) continue;
    const source = path.join(root, "public/legacy", name), originalBytes = fs.statSync(source).size;
    if (originalBytes < 100000) continue;
    const stem = name.replace(/\.[^.]+$/, ""), large = stem + "-1400.webp", small = stem + "-480.webp";
    await sharp(source).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(path.join(output, large));
    await sharp(source).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(path.join(output, small));
    manifest["/legacy/" + name] = { large: "/optimized/" + large, small: "/optimized/" + small, originalBytes, largeBytes: fs.statSync(path.join(output, large)).size, smallBytes: fs.statSync(path.join(output, small)).size };
  }
  fs.writeFileSync(path.join(root, "src/content/optimized-photos.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Prepared delivery variants for " + Object.keys(manifest).length + " photos; originals retained.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
