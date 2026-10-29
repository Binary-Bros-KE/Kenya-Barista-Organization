import "dotenv/config";
import { getDb } from "../src/server/database";
import { bootstrapAdmin } from "../src/server/bootstrap";
import { AccessError } from "../src/server/errors";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--email") throw new Error("Usage: npm.cmd run admin:bootstrap -- --email your-verified-email@example.com");
  const db = getDb();
  try {
    await bootstrapAdmin(db, args[1]);
    console.log("Initial administrator configured. Sign in again, then complete two-factor setup at /dashboard/security.");
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  console.error(error instanceof AccessError ? error.message : "Administrator setup failed. Check the database, migration, and command arguments.");
  process.exitCode = 1;
});
