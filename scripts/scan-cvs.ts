import "dotenv/config";
import { getDb } from "../src/server/database";
import { scanPendingCvs } from "../src/server/cv-scanner";
async function main() {
const db=getDb();
try { console.log(JSON.stringify(await scanPendingCvs(db))); }
catch { console.error("CV scanning could not complete. Files remain pending; check private storage and ClamAV."); process.exitCode=1; }
finally { await db.$disconnect(); }
}
main().catch(() => { console.error("CV scanning could not start."); process.exitCode=1; });
