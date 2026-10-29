import "dotenv/config";
import { getDb } from "../src/server/database";
import { reconcilePayments } from "../src/server/payments";
async function main() {
const db=getDb();
try { const result=await reconcilePayments(db);console.log(JSON.stringify(result));if(result.unavailable)process.exitCode=1; }
catch {console.error("Payment reconciliation could not complete. Check configuration and provider availability.");process.exitCode=1;}
finally {await db.$disconnect();}
}
main().catch(() => { console.error("Payment reconciliation could not start."); process.exitCode=1; });
