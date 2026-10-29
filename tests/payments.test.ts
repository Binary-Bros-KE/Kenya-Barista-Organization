import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient, type MpesaConfiguration } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { saveMpesaSettings, listMpesaSettings, paymentOptions } from "../src/server/mpesa-settings";
import { saveApplication } from "../src/server/applications";
import { initiatePayment, paymentSummary, receivePaymentCallback, reconcileAttempt } from "../src/server/payments";
import { DarajaError, type PaymentGateway } from "../src/server/daraja";
import { recordManualReversal } from "../src/server/manual-reversals";
import { expandNotificationEvent } from "../src/server/notification-worker";
import { listPaymentExceptions, paymentReviewDetail, resolvePaymentException } from "../src/server/payment-review";

test("payment lifecycle, merchant settings, idempotency, and transactional submission",{skip:process.env.RUN_DB_TESTS!=="true"||!process.env.PAYMENT_TEST_DATABASE_URL,timeout:180000},async t=>{
 const connectionString=process.env.PAYMENT_TEST_DATABASE_URL!,url=new URL(connectionString);assert.ok(["localhost","127.0.0.1","[::1]"].includes(url.hostname));assert.notEqual(url.port,"51214");
 // Prisma dev's embedded PostgreSQL protocol bridge cannot multiplex these nested relation reads.
 // CI uses native PostgreSQL with five connections to exercise overlapping transactions.
 const db=new PrismaClient({adapter:new PrismaPg({connectionString,max:Number(process.env.TEST_DATABASE_POOL_MAX||1)})});const suffix=randomUUID(),users:string[]=[],jobs:string[]=[],apps:string[]=[],configs:string[]=[];let orgId="";
 const previousKey=process.env.PAYMENT_ENCRYPTION_KEY,previousCallback=process.env.PAYMENT_CALLBACK_BASE_URL;
 process.env.PAYMENT_ENCRYPTION_KEY=randomBytes(32).toString("hex");process.env.PAYMENT_CALLBACK_BASE_URL="https://callbacks.example.test";
 let count=0;const requests=new Map<string,{callback:string;phone:string;amount:number;merchant:string;configId:string}>(),results=new Map<string,string|null>();
 const provider:PaymentGateway={async initiate(config,phone,amount,callback){const checkoutRequestId=`checkout-${++count}-${suffix}`,merchantRequestId=`merchant-${count}`;requests.set(checkoutRequestId,{callback,phone,amount,merchant:merchantRequestId,configId:config.id});results.set(checkoutRequestId,null);return {checkoutRequestId,merchantRequestId};},async query(_config,checkout){return {resultCode:results.get(checkout)??null,merchantRequestId:requests.get(checkout)?.merchant};}};
 async function actor(name:string,admin=false):Promise<Actor>{const user=await db.user.create({data:{name,email:`${name}-${suffix}@example.invalid`,emailVerified:true,role:admin?"ADMIN":"APPLICANT",twoFactorEnabled:admin}});users.push(user.id);return {user,session:{id:randomUUID(),mfaVerifiedAt:admin?new Date():null}};}
 let applicant:Actor,other:Actor,admin:Actor,config:Awaited<ReturnType<typeof saveMpesaSettings>>;
 const settings={kind:"PAYBILL",environment:"SANDBOX",label:"Test Paybill",businessShortCode:"174379",tillNumber:null,enabled:true,credentials:{consumerKey:"test-key-only",consumerSecret:"test-secret-only",passkey:"test-passkey-only"}};
 async function fixture(){
  const job=await db.job.create({data:{organisationId:orgId,slug:randomUUID(),title:"Test Barista",description:"Coffee team",location:"Nairobi",category:"BARISTA",employmentType:"FULL_TIME",status:"PUBLISHED",publishedAt:new Date(),deadline:new Date(Date.now()+86400000),applicationFeeMinor:10000}});jobs.push(job.id);
  const app=await db.application.create({data:{userId:applicant.user.id,jobId:job.id,applicationFeeMinor:10000,coverLetter:"Please consider my application."}});apps.push(app.id);
  await db.applicationDocument.create({data:{applicationId:app.id,documentId:(await db.document.findFirstOrThrow({where:{userId:applicant.user.id}})).id}});
  await db.paymentAttempt.updateMany({where:{paymentOrder:{application:{userId:applicant.user.id}}},data:{createdAt:new Date(Date.now()-7200000)}});
  return app;
 }
 async function begin(app:{id:string;version:number},which=config.id,chosenProvider=provider,key=randomUUID()){
  return initiatePayment(db,applicant,app.id,{configurationId:which,phone:"+254712345678",version:app.version,idempotencyKey:key},chosenProvider);
 }
 async function attempt(appId:string){return db.paymentAttempt.findFirstOrThrow({where:{paymentOrder:{applicationId:appId}},orderBy:{createdAt:"desc"}});}
 async function due(id:string){await db.paymentAttempt.update({where:{id},data:{queryAfter:new Date(0)}});}
 async function callback(appId:string,overrides:Record<string,unknown>={}){
  const a=await attempt(appId),request=requests.get(a.checkoutRequestId!)!;
  const payload={Body:{stkCallback:{CheckoutRequestID:a.checkoutRequestId,MerchantRequestID:a.merchantRequestId,ResultCode:0,CallbackMetadata:{Item:[{Name:"Amount",Value:request.amount/100},{Name:"PhoneNumber",Value:Number(request.phone)},{Name:"MpesaReceiptNumber",Value:randomBytes(6).toString("hex").toUpperCase()},...[]]},...overrides}}};
  return {token:new URL(request.callback).pathname.split("/").at(-1)!,payload};
 }
 try{
  assert.equal(await db.paymentOrder.count(),0,"Use an isolated empty payment database");assert.equal(await db.mpesaConfiguration.count(),0,"Use an isolated empty merchant database");
  applicant=await actor("payer");other=await actor("outsider");admin=await actor("payment-admin",true);
  const org=await db.organisation.create({data:{name:"Payment test employer",slug:`payments-${suffix}`}});orgId=org.id;
  await db.applicantProfile.create({data:{userId:applicant.user.id,fullName:"Test Applicant",phone:"+254712345678",location:"Nairobi",summary:"Coffee professional"}});
  const doc=await db.document.create({data:{userId:applicant.user.id,storageKey:randomUUID(),filename:"cv.pdf",mimeType:"application/pdf",sizeBytes:100,scanStatus:"CLEAN",sha256:"a".repeat(64)}});
  await t.test("settings require administrator MFA; secrets are encrypted and never returned",async()=>{
   await assert.rejects(saveMpesaSettings(db,applicant,settings),{status:403});await assert.rejects(saveMpesaSettings(db,{...admin,session:{...admin.session,mfaVerifiedAt:null}},settings),{code:"MFA_REQUIRED"});
   config=await saveMpesaSettings(db,admin,settings);configs.push(config.id);
   assert.ok(!JSON.stringify(await listMpesaSettings(db,admin)).includes("test-secret-only"));assert.ok(!("credentialsCipher" in config));
   const stored=await db.mpesaConfiguration.findUniqueOrThrow({where:{id:config.id}});assert.ok(!stored.credentialsCipher.includes("test-key-only"));
   await assert.rejects(saveMpesaSettings(db,admin,{...settings,kind:"TILL",tillNumber:null}));
  });
  await t.test("checkout rejects incomplete profiles, pending CVs and client fee overrides",async()=>{
   const app=await fixture();await db.document.update({where:{id:doc.id},data:{scanStatus:"PENDING"}});await assert.rejects(begin(app),{code:"CV_NOT_READY"});await db.document.update({where:{id:doc.id},data:{scanStatus:"CLEAN"}});
   await db.applicantProfile.update({where:{userId:applicant.user.id},data:{fullName:null}});await assert.rejects(begin(app),{code:"PROFILE_INCOMPLETE"});await db.applicantProfile.update({where:{userId:applicant.user.id},data:{fullName:"Test Applicant"}});
   await assert.rejects(initiatePayment(db,applicant,app.id,{configurationId:config.id,phone:"254712345678",version:1,idempotencyKey:randomUUID(),amount:1}));
   await assert.rejects(initiatePayment(db,other,app.id,{configurationId:config.id,phone:"254712345678",version:1,idempotencyKey:randomUUID()}),{status:404});
  });
  await t.test("one prompt is sent under retries and concurrent clicks; drafts freeze",async()=>{
   const app=await fixture(),key=randomUUID(),before=count;await Promise.all([begin(app,config.id,provider,key),begin(app,config.id,provider,key)]);assert.equal(count,before+1);
   await assert.rejects(begin({...app,version:2}),{code:"PAYMENT_IN_PROGRESS"});
   await assert.rejects(saveApplication(db,applicant,app.id,{version:2,coverLetter:"Changed",documentId:null}),{code:"PAYMENT_LOCKED"});
   const a=await attempt(app.id);await due(a.id);await reconcileAttempt(db,a.id,provider);assert.equal((await paymentSummary(db,applicant,app.id)).status,"DRAFT");
   await assert.rejects(paymentSummary(db,other,app.id),{status:404});
  });
  await t.test("forged, unknown, mismatched and duplicate callbacks cannot fabricate payment",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),cb=await callback(app.id);
   await assert.rejects(receivePaymentCallback(db,"x".repeat(43),cb.payload),{status:404});
   const wrong=structuredClone(cb.payload);wrong.Body.stkCallback.CheckoutRequestID="wrong";await assert.rejects(receivePaymentCallback(db,cb.token,wrong),{code:"PAYMENT_MISMATCH"});
   const wrongAmount=structuredClone(cb.payload);wrongAmount.Body.stkCallback.CallbackMetadata.Item[0].Value=1;await assert.rejects(receivePaymentCallback(db,cb.token,wrongAmount),{code:"PAYMENT_MISMATCH"});
   await receivePaymentCallback(db,cb.token,cb.payload);await receivePaymentCallback(db,cb.token,cb.payload);assert.equal(await db.paymentEvent.count({where:{paymentAttemptId:a.id,kind:"stk.callback"}}),1);
   await due(a.id);await reconcileAttempt(db,a.id,provider);assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.status,"PENDING");
  });
  await t.test("verified success submits exactly once using the frozen profile and CV",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),cb=await callback(app.id);await receivePaymentCallback(db,cb.token,cb.payload);
   await db.applicantProfile.update({where:{userId:applicant.user.id},data:{fullName:"Changed after checkout"}});results.set(a.checkoutRequestId!,"0");await due(a.id);
   await Promise.all([reconcileAttempt(db,a.id,provider),reconcileAttempt(db,a.id,provider)]);await reconcileAttempt(db,a.id,provider);
   const submitted=await db.application.findUniqueOrThrow({where:{id:app.id}});assert.equal(submitted.status,"SUBMITTED");assert.equal((submitted.submissionSnapshot as {fullName:string}).fullName,"Test Applicant");
   assert.equal(await db.applicationStatusHistory.count({where:{applicationId:app.id}}),1);assert.equal(await db.outboxEvent.count({where:{aggregateId:app.id,kind:"application.submitted"}}),1);assert.ok((await attempt(app.id)).receiptNumber);
   await db.applicantProfile.update({where:{userId:applicant.user.id},data:{fullName:"Test Applicant"}});
  });
  await t.test("missing callbacks stay in review, then a late receipt completes submission",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);
   assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.status,"NEEDS_REVIEW");assert.equal((await paymentSummary(db,applicant,app.id)).status,"DRAFT");
   const cb=await callback(app.id);await receivePaymentCallback(db,cb.token,cb.payload);await due(a.id);await reconcileAttempt(db,a.id,provider);assert.equal((await paymentSummary(db,applicant,app.id)).status,"SUBMITTED");
  });
  await t.test("provider cancellation permits edits and a later retry without a second order",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);results.set(a.checkoutRequestId!,"1032");await due(a.id);await reconcileAttempt(db,a.id,provider);assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.status,"CANCELLED");
   const saved=await saveApplication(db,applicant,app.id,{version:2,coverLetter:"Try again",documentId:doc.id});await db.paymentAttempt.update({where:{id:a.id},data:{createdAt:new Date(Date.now()-7200000)}});await begin({...app,version:saved.version});assert.equal(await db.paymentOrder.count({where:{applicationId:app.id}}),1);assert.equal(await db.paymentAttempt.count({where:{paymentOrder:{applicationId:app.id}}}),2);
  });
  await t.test("Till settings are separate and credential rotation preserves in-flight merchant",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);const next=await saveMpesaSettings(db,admin,{...settings,businessShortCode:"654321",credentials:undefined});configs.push(next.id);
   const till=await saveMpesaSettings(db,admin,{...settings,kind:"TILL",tillNumber:"7654321",label:"Test Till"});configs.push(till.id);assert.equal((await paymentOptions(db)).length,2);
   const old=await db.paymentAttempt.findUniqueOrThrow({where:{id:a.id},include:{configuration:true}});assert.equal(old.configurationId,config.id);assert.equal(old.configuration?.businessShortCode,"174379");assert.equal(old.configuration?.enabled,false);
   const tillApp=await fixture();await begin(tillApp,till.id);assert.equal((await attempt(tillApp.id)).configurationId,till.id);config=next;
  });
  await t.test("success after deadline or job changes records funds without submitting",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),cb=await callback(app.id);await receivePaymentCallback(db,cb.token,cb.payload);await db.job.update({where:{id:app.jobId},data:{deadline:new Date(Date.now()-1000)}});results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);
   const summary=await paymentSummary(db,applicant,app.id);assert.equal(summary.status,"DRAFT");assert.equal(summary.paymentOrder?.status,"SUCCEEDED");assert.equal(summary.paymentOrder?.attempts[0].reviewReason,"PAID_APPLICATION_UNAVAILABLE");await assert.rejects(begin({...app,version:2}),{code:"PAYMENT_IN_PROGRESS"});
  });
  await t.test("ambiguous network failure never automatically sends another prompt",async()=>{
   const app=await fixture();const unavailable:PaymentGateway={...provider,async initiate(){throw new DarajaError(false);}};
   const summary=await begin(app,config.id,unavailable);assert.equal(summary.paymentOrder?.status,"NEEDS_REVIEW");await assert.rejects(begin({...app,version:2}),{code:"PAYMENT_IN_PROGRESS"});
  });
  await t.test("explicit pre-send rejection unlocks retry; account rate limit remains enforced",async()=>{
   const app=await fixture();const rejected:PaymentGateway={...provider,async initiate(){throw new DarajaError(true);}};
   assert.equal((await begin(app,config.id,rejected)).paymentOrder?.status,"FAILED");await assert.rejects(begin({...app,version:2}),{code:"WAIT_BEFORE_RETRY"});
  });
  await t.test("an early callback is durable before initiation acknowledgement is saved",async()=>{
   const app=await fixture();
   const early:PaymentGateway={...provider,async initiate(merchant,phone,amount,callbackUrl,reference){
    const result=await provider.initiate(merchant,phone,amount,callbackUrl,reference);
    await receivePaymentCallback(db,new URL(callbackUrl).pathname.split("/").at(-1)!,{Body:{stkCallback:{CheckoutRequestID:result.checkoutRequestId,MerchantRequestID:result.merchantRequestId,ResultCode:0,CallbackMetadata:{Item:[{Name:"Amount",Value:amount/100},{Name:"PhoneNumber",Value:Number(phone)},{Name:"MpesaReceiptNumber",Value:randomBytes(6).toString("hex").toUpperCase()}]}}}});
    return result;
   }};
   await begin(app,config.id,early);const a=await attempt(app.id);results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);assert.equal((await paymentSummary(db,applicant,app.id)).status,"SUBMITTED");
  });
  await t.test("a receipt cannot pay for two different applications",async()=>{
   const used=await db.paymentAttempt.findFirstOrThrow({where:{status:"SUCCEEDED",receiptNumber:{not:null}}});
   const app=await fixture();await begin(app);const a=await attempt(app.id),cb=await callback(app.id);
   cb.payload.Body.stkCallback.CallbackMetadata.Item[2].Value=used.receiptNumber!;await receivePaymentCallback(db,cb.token,cb.payload);results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);
   const summary=await paymentSummary(db,applicant,app.id);assert.equal(summary.status,"DRAFT");assert.equal(summary.paymentOrder?.status,"NEEDS_REVIEW");assert.equal(summary.paymentOrder?.attempts[0].reviewReason,"DUPLICATE_RECEIPT");
  });
  await t.test("disabled merchants and modified job terms do not accept a new application",async()=>{
   const app=await fixture();const old=configs[0];await assert.rejects(begin(app,old),{code:"PAYMENT_OPTION_UNAVAILABLE"});
   await begin(app);const a=await attempt(app.id),cb=await callback(app.id);await receivePaymentCallback(db,cb.token,cb.payload);await db.job.update({where:{id:app.jobId},data:{version:{increment:1}}});results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);
   const summary=await paymentSummary(db,applicant,app.id);assert.equal(summary.status,"DRAFT");assert.equal(summary.paymentOrder?.status,"SUCCEEDED");
  });
  async function reviewData(appId:string,action:string,extra:Record<string,unknown>={}){
   const a=await attempt(appId),order=await db.paymentOrder.findUniqueOrThrow({where:{id:a.paymentOrderId}});
   return {version:order.version,attemptId:a.id,action,note:"Checked the original merchant statement for this application.",...(action!=="NOTE"?{evidenceReference:`CASE-${suffix}`,statementChecked:true}:{}),...extra};
  }
  await t.test("payment review is MFA-only, redacts secrets, and rejects stale or cross-order decisions",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),data=await reviewData(app.id,"NOTE");
   await assert.rejects(listPaymentExceptions(db,applicant),{status:403});
   await assert.rejects(paymentReviewDetail(db,{...admin,session:{...admin.session,mfaVerifiedAt:null}},a.paymentOrderId),{code:"MFA_REQUIRED"});
   await assert.rejects(resolvePaymentException(db,applicant,a.paymentOrderId,data),{status:403});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,{...data,attemptId:"other-order-attempt"}),{status:404});
   await resolvePaymentException(db,admin,a.paymentOrderId,data);
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,data),{code:"STALE_PAYMENT"});
   const detail=await paymentReviewDetail(db,admin,a.paymentOrderId),serialized=JSON.stringify(detail);
   for(const secret of ["credentialsCipher","payerCipher","evidenceCipher","callbackTokenHash","frozenSnapshot"])assert.ok(!serialized.includes(secret));
   assert.equal(detail.reviews.length,1);
  });
  await t.test("statement-confirmed no-charge requires ageing, no success evidence, and a free query lease",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"NOT_CHARGED")),{code:"UNSAFE_RETRY"});
   await db.paymentAttempt.update({where:{id:a.id},data:{createdAt:new Date(Date.now()-660000),queryLeaseUntil:new Date(Date.now()+60000)}});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"NOT_CHARGED")),{code:"PAYMENT_CHECK_RUNNING"});
   await db.paymentAttempt.update({where:{id:a.id},data:{queryLeaseUntil:null}});
   const data=await reviewData(app.id,"NOT_CHARGED"),outcomes=await Promise.allSettled([resolvePaymentException(db,admin,a.paymentOrderId,data),resolvePaymentException(db,admin,a.paymentOrderId,data)]);
   assert.equal(outcomes.filter(outcome=>outcome.status==="fulfilled").length,1);
   assert.equal((await db.paymentOrder.findUniqueOrThrow({where:{id:a.paymentOrderId}})).status,"FAILED");
   const saved=await saveApplication(db,applicant,app.id,{version:2,coverLetter:"Still interested",documentId:doc.id});
   await begin({...app,version:saved.version});assert.equal(await db.paymentAttempt.count({where:{paymentOrderId:a.paymentOrderId}}),2);
  });
  await t.test("late success after no-charge resolution holds checkout and replay does not duplicate review",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),cb=await callback(app.id);
   await db.paymentAttempt.update({where:{id:a.id},data:{createdAt:new Date(Date.now()-660000)}});
   await resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"NOT_CHARGED"));
   await receivePaymentCallback(db,cb.token,cb.payload);await receivePaymentCallback(db,cb.token,cb.payload);
   assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.reviewHold,true);
   assert.equal(await db.paymentReview.count({where:{paymentOrderId:a.paymentOrderId,action:"LATE_SUCCESS_EVIDENCE"}}),1);
   await assert.rejects(begin({...app,version:2}),{code:"PAYMENT_IN_PROGRESS"});
   await assert.rejects(saveApplication(db,applicant,app.id,{version:2,coverLetter:"Try editing",documentId:doc.id}),{code:"PAYMENT_LOCKED"});
   const receipt=String(cb.payload.Body.stkCallback.CallbackMetadata.Item[2].Value);
   await resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"CONFIRM_RECEIPT",{receipt,amountMinor:10000,phone:"254712345678",merchant:"654321"}));
   assert.equal((await paymentSummary(db,applicant,app.id)).status,"SUBMITTED");assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.reviewHold,false);
  });
  await t.test("manual receipt confirmation checks original merchant, payer, amount and receipt uniqueness",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),receipt=randomBytes(6).toString("hex").toUpperCase();
   const data=await reviewData(app.id,"CONFIRM_RECEIPT",{receipt,amountMinor:10000,phone:"254712345678",merchant:"654321"});
   for(const override of [{amountMinor:1},{phone:"254711111111"},{merchant:"174379"}])await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,{...data,...override}),{code:"STATEMENT_MISMATCH"});
   const used=await db.paymentAttempt.findFirstOrThrow({where:{receiptNumber:{not:null}}});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,{...data,receipt:used.receiptNumber}),{code:"DUPLICATE_RECEIPT"});
   const result=await resolvePaymentException(db,admin,a.paymentOrderId,data);assert.equal(result.submitted,true);
   assert.equal((await db.paymentAttempt.findUniqueOrThrow({where:{id:a.id}})).resultCode,null,"Statement confirmation must not invent a provider query result");
   assert.equal(await db.applicationStatusHistory.count({where:{applicationId:app.id}}),1);
   const event=await db.outboxEvent.findUniqueOrThrow({where:{deduplicationKey:`payment-review:${result.id}`}});await expandNotificationEvent(db,event.id);
   const alerts=await db.notification.findMany({where:{eventId:event.id}});assert.equal(alerts.length,1);assert.equal(alerts[0].userId,applicant.user.id);assert.ok(!JSON.stringify(alerts).includes(data.note));
  });
  await t.test("a Till receipt matches the original Till number rather than its HO shortcode",async()=>{
   const till=await db.mpesaConfiguration.findFirstOrThrow({where:{kind:"TILL",enabled:true}}),app=await fixture();await begin(app,till.id);const a=await attempt(app.id);
   const data=await reviewData(app.id,"CONFIRM_RECEIPT",{receipt:randomBytes(6).toString("hex").toUpperCase(),amountMinor:10000,phone:"254712345678",merchant:till.businessShortCode});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,data),{code:"STATEMENT_MISMATCH"});
   assert.equal((await resolvePaymentException(db,admin,a.paymentOrderId,{...data,merchant:till.tillNumber})).submitted,true);
  });
  await t.test("success evidence cannot be cleared as no-charge and callback changes invalidate open forms",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id),data=await reviewData(app.id,"NOT_CHARGED"),cb=await callback(app.id);
   await db.paymentAttempt.update({where:{id:a.id},data:{createdAt:new Date(Date.now()-660000)}});await receivePaymentCallback(db,cb.token,cb.payload);
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,data),{code:"STALE_PAYMENT"});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"NOT_CHARGED")),{code:"UNSAFE_RETRY"});
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"CONFIRM_RECEIPT",{receipt:"DIFFERENT1234",amountMinor:10000,phone:"254712345678",merchant:"654321"})),{code:"RECEIPT_CONFLICT"});
  });
  await t.test("paid but unavailable cases stay in queue; retry uses the original snapshot and never overrides changed terms",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);await db.document.update({where:{id:doc.id},data:{scanStatus:"PENDING"}});
   const data=await reviewData(app.id,"CONFIRM_RECEIPT",{receipt:randomBytes(6).toString("hex").toUpperCase(),amountMinor:10000,phone:"254712345678",merchant:"654321"});
   assert.equal((await resolvePaymentException(db,admin,a.paymentOrderId,data)).submitted,false);
   const queue=await listPaymentExceptions(db,admin);assert.ok(queue.orders.some(order=>order.id===a.paymentOrderId));
   await assert.rejects(resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"RETRY_SUBMISSION")),{code:"APPLICATION_UNAVAILABLE"});
   await db.document.update({where:{id:doc.id},data:{scanStatus:"CLEAN"}});
   assert.equal((await resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"RETRY_SUBMISSION"))).submitted,true);
   const changed=await db.paymentOrder.findFirstOrThrow({where:{status:"SUCCEEDED",application:{status:"DRAFT",job:{version:{gt:1}}}},include:{attempts:true}});
   await assert.rejects(resolvePaymentException(db,admin,changed.id,{...await reviewData(changed.applicationId,"RETRY_SUBMISSION"),attemptId:changed.attempts[0].id}),{code:"APPLICATION_UNAVAILABLE"});
  });
  await t.test("unchanged provider rechecks do not invalidate an administrator's review version",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);results.set(a.checkoutRequestId!,"0");await due(a.id);await reconcileAttempt(db,a.id,provider);
   const first=await db.paymentOrder.findUniqueOrThrow({where:{id:a.paymentOrderId}});await due(a.id);await reconcileAttempt(db,a.id,provider);
   assert.equal((await db.paymentOrder.findUniqueOrThrow({where:{id:a.paymentOrderId}})).version,first.version);
   const unknown=await fixture();await begin(unknown,config.id,{...provider,async initiate(){throw new DarajaError(false);}});const b=await attempt(unknown.id);
   await db.paymentAttempt.update({where:{id:b.id},data:{createdAt:new Date(Date.now()-660000)}});const initial=await db.paymentOrder.findUniqueOrThrow({where:{id:b.paymentOrderId}});
   await due(b.id);await reconcileAttempt(db,b.id,provider);assert.equal((await db.paymentOrder.findUniqueOrThrow({where:{id:b.paymentOrderId}})).version,initial.version);
  });
  await t.test("an older late receipt never submits a newer edited snapshot and holds survive newer no-charge resolution",async()=>{
   const app=await fixture();await begin(app);const first=await attempt(app.id),cb=await callback(app.id);
   await db.paymentAttempt.update({where:{id:first.id},data:{createdAt:new Date(Date.now()-1200000)}});
   await resolvePaymentException(db,admin,first.paymentOrderId,await reviewData(app.id,"NOT_CHARGED"));
   const saved=await saveApplication(db,applicant,app.id,{version:2,coverLetter:"A newer version after retry",documentId:doc.id});
   await begin({...app,version:saved.version});const second=await attempt(app.id);await receivePaymentCallback(db,cb.token,cb.payload);
   const receipt=String(cb.payload.Body.stkCallback.CallbackMetadata.Item[2].Value);
   const confirm={...await reviewData(app.id,"CONFIRM_RECEIPT",{receipt,amountMinor:10000,phone:"254712345678",merchant:"654321"}),attemptId:first.id};
   await assert.rejects(resolvePaymentException(db,admin,first.paymentOrderId,confirm),{code:"OTHER_ATTEMPT_UNRESOLVED"});
   await db.paymentAttempt.update({where:{id:second.id},data:{createdAt:new Date(Date.now()-660000)}});
   await resolvePaymentException(db,admin,first.paymentOrderId,await reviewData(app.id,"NOT_CHARGED"));
   assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.reviewHold,true);
   const result=await resolvePaymentException(db,admin,first.paymentOrderId,{...confirm,version:(await db.paymentOrder.findUniqueOrThrow({where:{id:first.paymentOrderId}})).version});
   assert.equal(result.submitted,false);assert.equal((await paymentSummary(db,applicant,app.id)).status,"DRAFT");
   await recordManualReversal(db,admin,first.paymentOrderId,{attemptId:first.id,reference:`OLDER-${suffix}`,note:"Older late charge returned manually in full to original payer.",confirmedReturnedToPayer:true});
   assert.equal((await paymentSummary(db,applicant,app.id)).paymentOrder?.reviewHold,false);
  });
  await t.test("damaged frozen snapshots cannot be submitted by manual confirmation",async()=>{
   const app=await fixture();await begin(app);const a=await attempt(app.id);await db.paymentOrder.update({where:{id:a.paymentOrderId},data:{frozenSnapshot:{documentId:doc.id}}});
   const result=await resolvePaymentException(db,admin,a.paymentOrderId,await reviewData(app.id,"CONFIRM_RECEIPT",{receipt:randomBytes(6).toString("hex").toUpperCase(),amountMinor:10000,phone:"254712345678",merchant:"654321"}));
   assert.equal(result.submitted,false);assert.equal((await paymentSummary(db,applicant,app.id)).status,"DRAFT");
  });
  await t.test("manual reversal requires MFA, records full original amount once, and preserves the application",async()=>{
   const paid=await db.paymentOrder.findFirstOrThrow({where:{status:"SUCCEEDED",application:{status:"SUBMITTED"}},include:{attempts:true}});
   const successful=paid.attempts.find(item=>item.status==="SUCCEEDED")!;
   const data={attemptId:successful.id,reference:`REV-${suffix}`,note:"Returned in full to the original payer via merchant portal.",confirmedReturnedToPayer:true};
   await assert.rejects(recordManualReversal(db,applicant,paid.id,data),{status:403});
   await assert.rejects(recordManualReversal(db,{...admin,session:{...admin.session,mfaVerifiedAt:null}},paid.id,data),{code:"MFA_REQUIRED"});
   await assert.rejects(recordManualReversal(db,admin,paid.id,{...data,confirmedReturnedToPayer:false}));
   await assert.rejects(recordManualReversal(db,admin,paid.id,{...data,amountMinor:1}));
   await assert.rejects(recordManualReversal(db,admin,paid.id,{...data,attemptId:"missing"}),{status:404});
   const results=await Promise.all([recordManualReversal(db,admin,paid.id,data),recordManualReversal(db,admin,paid.id,data)]);
   assert.equal(results[0].id,results[1].id);
   assert.equal(await db.refundRecord.count({where:{paymentOrderId:paid.id}}),1);
   const refund=await db.refundRecord.findUniqueOrThrow({where:{id:results[0].id}});
   assert.equal(refund.amountMinor,paid.amountMinor);assert.equal(refund.completedById,admin.user.id);assert.ok(refund.completedAt);
   assert.equal((await db.paymentOrder.findUniqueOrThrow({where:{id:paid.id}})).status,"REFUNDED");
   assert.equal((await db.application.findUniqueOrThrow({where:{id:paid.applicationId}})).status,"SUBMITTED");
   assert.equal(await db.paymentReview.count({where:{refundId:refund.id}}),1);
   await assert.rejects(recordManualReversal(db,admin,paid.id,{...data,reference:"DIFFERENT-REF"}),{code:"ALREADY_REVERSED"});
   const summary=await paymentSummary(db,applicant,paid.applicationId);
   assert.equal(summary.paymentOrder?.refunds[0].providerReference,data.reference);
   assert.ok(!JSON.stringify(summary).includes(data.note));
   const event=await db.outboxEvent.findUniqueOrThrow({where:{deduplicationKey:`refund:${refund.id}:completed`}});
   await expandNotificationEvent(db,event.id);
   const alerts=await db.notification.findMany({where:{eventId:event.id}});
   assert.equal(alerts.length,1);assert.equal(alerts[0].userId,applicant.user.id);assert.ok(!JSON.stringify(alerts).includes(data.note));
   const unpaid=await db.paymentOrder.findFirstOrThrow({where:{status:"PENDING"},include:{attempts:true}});
   await assert.rejects(recordManualReversal(db,admin,unpaid.id,{...data,attemptId:unpaid.attempts[0].id}),{code:"PAYMENT_NOT_REVERSIBLE"});
  });
 }finally{
  const refunds=await db.refundRecord.findMany({where:{order:{applicationId:{in:apps}}},select:{id:true}});
  const reviews=await db.paymentReview.findMany({where:{order:{applicationId:{in:apps}}},select:{id:true}});
  const refundEvents=await db.outboxEvent.findMany({where:{aggregateId:{in:[...refunds,...reviews].map(item=>item.id)}},select:{id:true}});
  await db.notification.deleteMany({where:{eventId:{in:refundEvents.map(item=>item.id)}}});
  await db.outboxEvent.deleteMany({where:{id:{in:refundEvents.map(item=>item.id)}}});
  await db.paymentReview.deleteMany({where:{order:{applicationId:{in:apps}}}});
  await db.refundRecord.deleteMany({where:{order:{applicationId:{in:apps}}}});
  await db.paymentEvent.deleteMany({where:{paymentAttempt:{paymentOrder:{applicationId:{in:apps}}}}});await db.paymentAttempt.deleteMany({where:{paymentOrder:{applicationId:{in:apps}}}});await db.paymentOrder.deleteMany({where:{applicationId:{in:apps}}});
  await db.applicationStatusHistory.deleteMany({where:{applicationId:{in:apps}}});await db.applicationDocument.deleteMany({where:{applicationId:{in:apps}}});await db.application.deleteMany({where:{id:{in:apps}}});await db.document.deleteMany({where:{userId:{in:users}}});await db.applicantProfile.deleteMany({where:{userId:{in:users}}});await db.job.deleteMany({where:{id:{in:jobs}}});if(orgId)await db.organisation.delete({where:{id:orgId}});
  await db.outboxEvent.deleteMany({where:{aggregateId:{in:apps}}});await db.auditLog.deleteMany({where:{actorId:{in:users}}});await db.mpesaConfiguration.deleteMany({where:{id:{in:configs}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
  if(previousKey===undefined)delete process.env.PAYMENT_ENCRYPTION_KEY;else process.env.PAYMENT_ENCRYPTION_KEY=previousKey;if(previousCallback===undefined)delete process.env.PAYMENT_CALLBACK_BASE_URL;else process.env.PAYMENT_CALLBACK_BASE_URL=previousCallback;
 }
});
