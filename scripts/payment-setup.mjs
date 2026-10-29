import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const file=new URL("../.env",import.meta.url);
const source=await readFile(file,"utf8");
if(/^PAYMENT_ENCRYPTION_KEY=.+$/m.test(source))console.log("Payment encryption key already exists; it was retained.");
else {await writeFile(file,source.replace(/^PAYMENT_ENCRYPTION_KEY=.*\r?\n?/m,"")+"\nPAYMENT_ENCRYPTION_KEY="+randomBytes(32).toString("hex")+"\n");console.log("Created a payment encryption key in .env. Keep it private and back it up; it is required to decrypt stored credentials.");}

