import "dotenv/config";
import { getDb } from "../src/server/database";
import { closeExpiredJobs } from "../src/server/jobs";
async function main() {
  const db = getDb();
  try { const result = await closeExpiredJobs(db); console.log(`Closed ${result.closed} expired jobs (batch limit ${result.batchLimit}).`); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Unable to close expired jobs. Check the database connection and migrations."); process.exitCode = 1; });
