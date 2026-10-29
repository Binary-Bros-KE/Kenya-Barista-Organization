import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { sendMail, validateMailConfiguration } from "../src/server/mail";
test("stable notification IDs produce one atomic private preview under concurrent retries",async()=>{
 const previous={NODE_ENV:process.env.NODE_ENV,APP_URL:process.env.APP_URL,EMAIL_MODE:process.env.EMAIL_MODE};
 Object.assign(process.env,{NODE_ENV:"development",APP_URL:"http://localhost:3000",EMAIL_MODE:"file"});
 const message={to:`preview-${randomUUID()}@example.invalid`,subject:"Private notification preview",text:"Sign in to view your update.",messageId:`<notification-test-${randomUUID()}@localhost>`};
 const file=path.join(process.cwd(),".dev-mail",`notification-${createHash("sha256").update(message.messageId).digest("hex")}.json`);
 try{
  await Promise.all([sendMail(message),sendMail(message)]);const saved=JSON.parse(await readFile(file,"utf8"));assert.equal(saved.messageId,message.messageId);assert.equal(saved.to,message.to);assert.equal(saved.text,message.text);
  Object.assign(process.env,{NODE_ENV:"production"});assert.throws(()=>validateMailConfiguration(),/restricted to local development/);
 }finally{await unlink(file).catch(()=>{});for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
