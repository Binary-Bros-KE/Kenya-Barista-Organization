import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { expandNotificationEvent, deliverNotification, runNotificationWorker } from "../src/server/notification-worker";
import { listNotifications, markNotificationRead, saveNotificationPreference, notificationOperations, retryNotificationWork } from "../src/server/notification-access";
import type { MailMessage } from "../src/server/mail";

test("durable notifications, access, preferences, leases, retries and fanout", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.NOTIFICATION_TEST_DATABASE_URL, timeout: 180000 }, async t => {
 const connectionString=process.env.NOTIFICATION_TEST_DATABASE_URL!,url=new URL(connectionString);assert.ok(["localhost","127.0.0.1","[::1]"].includes(url.hostname));assert.notEqual(url.port,"51214");
 const db=new PrismaClient({adapter:new PrismaPg({connectionString,max:Number(process.env.TEST_DATABASE_POOL_MAX||1)})});
 const userIds:string[]=[],jobIds:string[]=[],appIds:string[]=[],eventIds:string[]=[],responseIds:string[]=[];let orgId="";const suffix=randomUUID();
 const mail:MailMessage[]=[];const deliver=async(message:MailMessage)=>{mail.push(message);};
 async function actor(name:string,admin=false):Promise<Actor>{const user=await db.user.create({data:{name,email:`${name}-${suffix}@example.invalid`,emailVerified:true,role:admin?"ADMIN":"APPLICANT",twoFactorEnabled:admin}});userIds.push(user.id);return {user,session:{id:randomUUID(),mfaVerifiedAt:admin?new Date():null}};}
 async function event(kind:string,aggregateId:string){const row=await db.outboxEvent.create({data:{kind,aggregateId,deduplicationKey:randomUUID()}});eventIds.push(row.id);return row;}
 async function due(id:string){await db.notification.update({where:{id},data:{availableAt:new Date(0)}});}
 async function notifications(eventId:string){return db.notification.findMany({where:{eventId},orderBy:{userId:"asc"}});}
 try{
  assert.equal(await db.outboxEvent.count(),0,"Use an isolated empty outbox database");assert.equal(await db.notification.count(),0,"Use an isolated empty notification database");
  const candidate=await actor("notify-candidate"),employer=await actor("notify-employer"),admin=await actor("notify-admin",true),outsider=await actor("notify-outsider");
  const org=await db.organisation.create({data:{name:"Notification coffee team",slug:`notify-${suffix}`}});orgId=org.id;
  await db.organisationMember.create({data:{userId:employer.user.id,organisationId:orgId}});
  const job=await db.job.create({data:{organisationId:orgId,slug:randomUUID(),title:"Notification role",description:"Coffee role",location:"Nairobi",category:"BARISTA",employmentType:"FULL_TIME",applicationFeeMinor:10000,deadline:new Date(Date.now()+86400000),status:"PUBLISHED",publishedAt:new Date()}});jobIds.push(job.id);
  const app=await db.application.create({data:{userId:candidate.user.id,jobId:job.id,status:"SUBMITTED",submittedAt:new Date(),applicationFeeMinor:10000,paymentOrder:{create:{amountMinor:10000,status:"SUCCEEDED",paidAt:new Date()}}}});appIds.push(app.id);
  await t.test("submission fanout is deduplicated under concurrent workers",async()=>{
   const row=await event("application.submitted",app.id);await Promise.all([expandNotificationEvent(db,row.id),expandNotificationEvent(db,row.id)]);
   const items=await notifications(row.id);assert.equal(items.length,2);assert.ok(items.some(n=>n.userId===candidate.user.id&&n.audience==="APPLICANT"));assert.ok(items.some(n=>n.userId===employer.user.id&&n.audience==="EMPLOYER"));
   assert.equal(await expandNotificationEvent(db,row.id),false);assert.equal((await notifications(row.id)).length,2);
   const target=items.find(n=>n.userId===candidate.user.id)!;const before=mail.length;
   await Promise.all([deliverNotification(db,target.id,deliver),deliverNotification(db,target.id,deliver)]);assert.equal(mail.length,before+1);assert.equal((await db.notification.findUniqueOrThrow({where:{id:target.id}})).deliveryStatus,"SENT");assert.ok(mail.at(-1)!.messageId?.includes(target.id));
  });
  await t.test("only the owner can list or mark a notification read",async()=>{
   const items=(await listNotifications(db,candidate,{})).notifications;assert.equal(items.length,1);await assert.rejects(markNotificationRead(db,outsider,items[0].id),{status:404});
   assert.equal((await listNotifications(db,outsider,{})).pagination.total,0);await markNotificationRead(db,candidate,items[0].id);await markNotificationRead(db,candidate,items[0].id);assert.equal((await listNotifications(db,candidate,{unread:"true"})).unread,0);
   await assert.rejects(listNotifications(db,candidate,{page:0}));await assert.rejects(saveNotificationPreference(db,candidate,{emailEnabled:false,userId:admin.user.id}));
  });
  await t.test("email opt-out preserves dashboard alerts and skips delivery",async()=>{
   await saveNotificationPreference(db,candidate,{emailEnabled:false});const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===candidate.user.id)!;
   const before=mail.length;await deliverNotification(db,item.id,deliver);assert.equal(mail.length,before);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).lastError,"EMAIL_DISABLED");assert.ok((await listNotifications(db,candidate,{})).notifications.some(n=>n.id===item.id));await saveNotificationPreference(db,candidate,{emailEnabled:true});
  });
  await t.test("membership revocation hides alerts and prevents queued employer email",async()=>{
   const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===employer.user.id)!;
   await db.organisationMember.deleteMany({where:{userId:employer.user.id}});assert.equal((await listNotifications(db,employer,{})).pagination.total,0);await assert.rejects(markNotificationRead(db,employer,item.id),{status:404});
   await deliverNotification(db,item.id,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).lastError,"ACCESS_REVOKED");await db.organisationMember.create({data:{userId:employer.user.id,organisationId:orgId}});
  });
  await t.test("SMTP errors retry with backoff, dead-letter safely, and permit MFA-admin retry",async()=>{
   const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===candidate.user.id)!;
   const fail=async()=>{throw new Error("password=PRIVATE_SMTP_SECRET and private email");};
   for(let attempt=1;attempt<=5;attempt++){await due(item.id);assert.equal(await deliverNotification(db,item.id,fail),false);const current=await db.notification.findUniqueOrThrow({where:{id:item.id}});assert.equal(current.attempts,attempt);assert.equal(current.deliveryStatus,attempt===5?"FAILED":"PENDING");assert.ok(current.availableAt.getTime()>Date.now());assert.equal(current.lastError,"EMAIL_DELIVERY_FAILED");}
   await assert.rejects(retryNotificationWork(db,candidate,{id:item.id,target:"delivery"}),{status:403});await assert.rejects(retryNotificationWork(db,{...admin,session:{...admin.session,mfaVerifiedAt:null}},{id:item.id,target:"delivery"}),{code:"MFA_REQUIRED"});
   await retryNotificationWork(db,admin,{id:item.id,target:"delivery"});await deliverNotification(db,item.id,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).deliveryStatus,"SENT");await assert.rejects(retryNotificationWork(db,admin,{id:item.id,target:"delivery"}),{code:"NOT_RETRYABLE"});
  });
  await t.test("unsupported events fail without losing queue records and can be redriven",async()=>{
   const row=await event("unsupported.kind",job.id);
   for(let attempt=1;attempt<=5;attempt++){await db.outboxEvent.update({where:{id:row.id},data:{availableAt:new Date(0)}});assert.equal(await expandNotificationEvent(db,row.id),false);}
   const failed=await db.outboxEvent.findUniqueOrThrow({where:{id:row.id}});assert.ok(failed.failedAt);assert.equal(failed.lastError,"UNSUPPORTED_EVENT");
   await retryNotificationWork(db,admin,{id:row.id,target:"event"});await db.outboxEvent.update({where:{id:row.id},data:{kind:"job.updated"}});await expandNotificationEvent(db,row.id);assert.ok((await db.outboxEvent.findUniqueOrThrow({where:{id:row.id}})).processedAt);
  });
  await t.test("response emails omit message contents and stop after withdrawal",async()=>{
   const response=await db.applicationResponse.create({data:{applicationId:app.id,authorId:employer.user.id,source:"EMPLOYER",senderLabel:"Coffee team",body:"PRIVATE_RESPONSE_BODY",status:"SUBMITTED"}});responseIds.push(response.id);
   const row=await event("application.response",response.id);await expandNotificationEvent(db,row.id);const items=await notifications(row.id);assert.equal(items.length,1);assert.equal(items[0].userId,candidate.user.id);await deliverNotification(db,items[0].id,deliver);assert.ok(!mail.at(-1)!.text.includes("PRIVATE_RESPONSE_BODY"));
   const late=await event("application.response",response.id);await expandNotificationEvent(db,late.id);const delayed=(await notifications(late.id))[0];await db.application.update({where:{id:app.id},data:{status:"WITHDRAWN"}});await deliverNotification(db,delayed.id,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:delayed.id}})).deliveryStatus,"SKIPPED");
   const withdrawal=await event("application.withdrawn",app.id);await expandNotificationEvent(db,withdrawal.id);assert.equal((await notifications(withdrawal.id)).length,2);await db.application.update({where:{id:app.id},data:{status:"SUBMITTED"}});
  });
  await t.test("job review and changes-requested notices never reach applicants",async()=>{
   await db.job.update({where:{id:job.id},data:{status:"PENDING_REVIEW"}});const row=await event("job.submit",job.id);await expandNotificationEvent(db,row.id);const items=await notifications(row.id);assert.equal(items.length,2);assert.ok(!items.some(n=>n.userId===candidate.user.id));
   assert.equal((await listNotifications(db,{...admin,session:{...admin.session,mfaVerifiedAt:null}},{})).pagination.total,0);assert.ok((await listNotifications(db,admin,{})).pagination.total>0);
   await db.job.update({where:{id:job.id},data:{status:"CHANGES_REQUESTED",reviewNote:"PRIVATE_ADMIN_REVIEW_NOTE"}});const changes=await event("job.request_changes",job.id);await expandNotificationEvent(db,changes.id);const notices=await notifications(changes.id);assert.equal(notices.length,1);assert.equal(notices[0].userId,employer.user.id);assert.ok(!JSON.stringify(notices).includes("PRIVATE_ADMIN_REVIEW_NOTE"));await db.job.update({where:{id:job.id},data:{status:"PUBLISHED"}});
  });
  await t.test("account suspension is rechecked immediately before email",async()=>{
   const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===candidate.user.id)!;await db.user.update({where:{id:candidate.user.id},data:{status:"SUSPENDED"}});const before=mail.length;await deliverNotification(db,item.id,deliver);assert.equal(mail.length,before);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).lastError,"ACCOUNT_UNAVAILABLE");await db.user.update({where:{id:candidate.user.id},data:{status:"ACTIVE"}});
  });
  await t.test("unverified addresses are excluded from fanout and from already queued delivery",async()=>{
   const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===candidate.user.id)!;
   await db.user.update({where:{id:candidate.user.id},data:{emailVerified:false}});await deliverNotification(db,item.id,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).lastError,"ACCOUNT_UNAVAILABLE");
   const later=await event("application.submitted",app.id);await expandNotificationEvent(db,later.id);assert.ok(!(await notifications(later.id)).some(n=>n.userId===candidate.user.id));await db.user.update({where:{id:candidate.user.id},data:{emailVerified:true}});
  });
  await t.test("expired leases recover and the last-attempt crash cannot stay pending forever",async()=>{
   const row=await event("application.submitted",app.id);await expandNotificationEvent(db,row.id);const item=(await notifications(row.id)).find(n=>n.userId===candidate.user.id)!;
   await db.notification.update({where:{id:item.id},data:{leaseToken:"old-worker",leaseUntil:new Date(0),attempts:1}});await deliverNotification(db,item.id,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:item.id}})).deliveryStatus,"SENT");
   const last=(await notifications(row.id)).find(n=>n.userId===employer.user.id)!;await db.notification.updateMany({where:{eventId:{in:eventIds},deliveryStatus:"PENDING",id:{not:last.id}},data:{availableAt:new Date(Date.now()+86400000)}});
   await db.notification.update({where:{id:last.id},data:{attempts:5,leaseToken:"crashed-worker",leaseUntil:new Date(0)}});await runNotificationWorker(db,deliver);assert.equal((await db.notification.findUniqueOrThrow({where:{id:last.id}})).deliveryStatus,"FAILED");
  });
  await t.test("large fanouts resume in pages without creating duplicate alerts",async()=>{
   const extra=Array.from({length:101},(_,index)=>({id:randomUUID(),email:`fanout-${index}-${suffix}@example.invalid`,emailVerified:true}));userIds.push(...extra.map(u=>u.id));await db.user.createMany({data:extra});
   const applications=extra.map(user=>({id:randomUUID(),userId:user.id,jobId:job.id,status:"DRAFT" as const,applicationFeeMinor:10000}));appIds.push(...applications.map(a=>a.id));await db.application.createMany({data:applications});
   const row=await event("job.updated",job.id);await expandNotificationEvent(db,row.id);assert.equal((await notifications(row.id)).length,100);assert.equal((await db.outboxEvent.findUniqueOrThrow({where:{id:row.id}})).processedAt,null);
   await expandNotificationEvent(db,row.id);assert.equal((await notifications(row.id)).length,103);assert.ok((await db.outboxEvent.findUniqueOrThrow({where:{id:row.id}})).processedAt);
   await db.outboxEvent.update({where:{id:row.id},data:{processedAt:null,recipientCursor:null}});await expandNotificationEvent(db,row.id);await expandNotificationEvent(db,row.id);assert.equal((await notifications(row.id)).length,103);
   const listing=await listNotifications(db,candidate,{page:1});assert.ok(listing.pagination.total>0);await assert.rejects(notificationOperations(db,employer),{status:403});const operations=await notificationOperations(db,admin);assert.ok(operations.counts.deliveriesPending>0);assert.ok(!JSON.stringify(operations).includes("PRIVATE_SMTP_SECRET"));
  });
 }finally{
  await db.notification.deleteMany({where:{eventId:{in:eventIds}}});await db.outboxEvent.deleteMany({where:{id:{in:eventIds}}});await db.applicationResponse.deleteMany({where:{id:{in:responseIds}}});await db.paymentOrder.deleteMany({where:{applicationId:{in:appIds}}});await db.application.deleteMany({where:{id:{in:appIds}}});await db.job.deleteMany({where:{id:{in:jobIds}}});await db.organisationMember.deleteMany({where:{userId:{in:userIds}}});if(orgId)await db.organisation.delete({where:{id:orgId}});await db.auditLog.deleteMany({where:{actorId:{in:userIds}}});await db.user.deleteMany({where:{id:{in:userIds}}});await db.$disconnect();
 }
});
