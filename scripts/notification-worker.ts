import "dotenv/config";
import { getDb } from "../src/server/database";
import { validateMailConfiguration } from "../src/server/mail";
import { runNotificationWorker } from "../src/server/notification-worker";
async function main() {
const watch = process.argv.includes("--watch"), db = getDb();
let stopping = false;
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
try {
  validateMailConfiguration();
  do {
    try { console.log(JSON.stringify(await runNotificationWorker(db))); }
    catch { console.error("Notification worker could not complete a batch. Check database and mail configuration."); if (!watch) process.exitCode = 1; }
    if (watch && !stopping) await new Promise(resolve => setTimeout(resolve, 10000));
  } while (watch && !stopping);
} catch { console.error("Notification worker configuration is invalid. Check local email mode or SMTP settings."); process.exitCode = 1; }
finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Notification worker could not start."); process.exitCode = 1; });
