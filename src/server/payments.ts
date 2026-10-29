import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { type Actor } from "./access";
import { profileInput } from "./applications";
import { AccessError } from "./errors";
import { DarajaError, DarajaGateway, type PaymentGateway } from "./daraja";
import { sealPaymentSecret, openPaymentSecret } from "./payment-secrets";

import { lockPaymentOrder, settlePayment } from "./payment-settlement";

const gateway=new DarajaGateway();
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const busyStatuses=["PENDING","NEEDS_REVIEW","SUCCEEDED","REFUNDED"] as const;
type Snapshot={fullName:string;email:string;phone:string;location:string;summary:string;coverLetter:string;documentId:string;documentSha256:string;jobTitle:string;organisationName:string;jobVersion:number;applicationVersion:number};
export function callbackBase(){
 const base=process.env.PAYMENT_CALLBACK_BASE_URL;
 if(!base)throw new AccessError(503,"CALLBACK_NOT_CONFIGURED","Payment callbacks are not configured");
 const url=new URL(base);
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new AccessError(503,"CALLBACK_NOT_CONFIGURED","Configure a public HTTPS callback origin");
 return url.origin;
}
export async function initiatePayment(db:PrismaClient,actor:Actor,applicationId:string,input:unknown,provider:PaymentGateway=gateway){
 const data=z.object({configurationId:z.string().min(1).max(100),phone:z.string().regex(/^\+?254[17]\d{8}$/).transform(v=>v.replace(/^\+/,"")),idempotencyKey:z.uuid(),version:z.number().int().positive()}).strict().parse(input);
 const base=callbackBase(), token=randomBytes(32).toString("base64url");
 const reservation=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
  const previous=await tx.paymentAttempt.findUnique({where:{idempotencyKey:data.idempotencyKey},include:{paymentOrder:true}});
  if(previous){
   if(previous.paymentOrder.applicationId!==applicationId||previous.configurationId!==data.configurationId||!previous.payerCipher||openPaymentSecret<{phone:string}>(previous.payerCipher,`payer:${previous.id}`).phone!==data.phone)throw new AccessError(409,"IDEMPOTENCY_CONFLICT","Use a new payment request key");
   const owned=await tx.application.findFirst({where:{id:applicationId,userId:actor.user.id}});if(!owned)throw new AccessError(404,"NOT_FOUND","Application not found");
   return {attempt:previous,send:false,config:null};
  }
  await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${applicationId} FOR UPDATE`;
  const application=await tx.application.findFirst({where:{id:applicationId,userId:actor.user.id},include:{user:{include:{profile:true}},job:{include:{organisation:true}},documents:{include:{document:true}},paymentOrder:true}});
  if(!application)throw new AccessError(404,"NOT_FOUND","Application not found");
  if(application.status!=="DRAFT")throw new AccessError(409,"ALREADY_SUBMITTED","This application is already submitted");
  if(application.version!==data.version)throw new AccessError(409,"STALE_APPLICATION","Reload your application before paying");
  if(application.paymentOrder&&(application.paymentOrder.reviewHold||busyStatuses.includes(application.paymentOrder.status as typeof busyStatuses[number])))throw new AccessError(409,"PAYMENT_IN_PROGRESS","A payment is already pending, paid, or awaiting review. Check its status before retrying");
  const job=application.job;
  if(job.status!=="PUBLISHED"||!job.publishedAt||job.deadline<=new Date()||job.organisation.suspendedAt)throw new AccessError(409,"JOB_UNAVAILABLE","This job is no longer accepting applications");
  if(application.user.status!=="ACTIVE"||!application.user.emailVerified)throw new AccessError(403,"ACCOUNT_UNAVAILABLE","Account access unavailable");
  const profile=profileInput.safeParse(application.user.profile ? {fullName:application.user.profile.fullName,phone:application.user.profile.phone,location:application.user.profile.location,summary:application.user.profile.summary||""}:{});
  if(!profile.success)throw new AccessError(409,"PROFILE_INCOMPLETE","Complete your profile before paying");
  const document=application.documents.length===1?application.documents[0].document:null;
  if(!document||document.userId!==actor.user.id||document.scanStatus!=="CLEAN"||!document.sha256)throw new AccessError(409,"CV_NOT_READY","Attach a CV that has passed security screening before paying");
  if(application.currency!=="KES"||application.applicationFeeMinor<100||application.applicationFeeMinor%100!==0||application.applicationFeeMinor>25000000)throw new AccessError(409,"INVALID_FEE","The application fee must be configured as whole KES within M-Pesa limits");
  const config=await tx.mpesaConfiguration.findFirst({where:{id:data.configurationId,enabled:true,...(process.env.NODE_ENV==="production"?{environment:"LIVE" as const}:{})}});
  if(!config)throw new AccessError(409,"PAYMENT_OPTION_UNAVAILABLE","This payment option is unavailable");
  const recent=await tx.paymentAttempt.findFirst({where:{paymentOrder:{application:{userId:actor.user.id}}},orderBy:{createdAt:"desc"}});
  if(recent&&recent.createdAt.getTime()>Date.now()-60000)throw new AccessError(429,"WAIT_BEFORE_RETRY","Wait at least one minute before requesting another prompt");
  if(await tx.paymentAttempt.count({where:{paymentOrder:{application:{userId:actor.user.id}},createdAt:{gt:new Date(Date.now()-3600000)}}})>=5)throw new AccessError(429,"PAYMENT_RATE_LIMIT","Too many payment requests. Try again later");
  const snapshot:Snapshot={...profile.data,email:application.user.email,coverLetter:application.coverLetter,documentId:document.id,documentSha256:document.sha256,jobTitle:job.title,organisationName:job.organisation.name,jobVersion:job.version,applicationVersion:application.version+1};
  await tx.application.update({where:{id:applicationId},data:{version:{increment:1}}});
  const order=await tx.paymentOrder.upsert({where:{applicationId},create:{applicationId,amountMinor:application.applicationFeeMinor,currency:application.currency,frozenSnapshot:snapshot},update:{status:"PENDING",frozenSnapshot:snapshot,version:{increment:1}}});
  const id=randomUUID();
  const attempt=await tx.paymentAttempt.create({data:{id,paymentOrderId:order.id,configurationId:config.id,idempotencyKey:data.idempotencyKey,payerCipher:sealPaymentSecret({phone:data.phone},`payer:${id}`),callbackTokenHash:hash(token),queryAfter:new Date(Date.now()+15000)}});
  await tx.auditLog.create({data:{actorId:actor.user.id,action:"payment.initiated",entityType:"PaymentOrder",entityId:order.id}});
  return {attempt,send:true,config,amountMinor:order.amountMinor};
 },{timeout:15000});
 if(reservation.send&&reservation.config){
  try{
   const result=await provider.initiate(reservation.config,data.phone,reservation.amountMinor!,`${base}/api/payments/notify/${token}`,reservation.attempt.id.replace(/-/g,"").slice(0,12));
   await db.paymentAttempt.update({where:{id:reservation.attempt.id},data:{checkoutRequestId:result.checkoutRequestId,merchantRequestId:result.merchantRequestId}});
  }catch(error){
   const definitive=error instanceof DarajaError&&error.definitive;
   await db.$transaction(async tx=>{
    await lockPaymentOrder(tx,reservation.attempt.paymentOrderId);
    const current=await tx.paymentAttempt.findUniqueOrThrow({where:{id:reservation.attempt.id}});
    if(!["PENDING","NEEDS_REVIEW"].includes(current.status))return;
    await tx.paymentAttempt.update({where:{id:reservation.attempt.id},data:{status:definitive?"FAILED":"NEEDS_REVIEW",reviewReason:definitive?"REQUEST_REJECTED":"INITIATION_UNCERTAIN"}});
    await tx.paymentOrder.update({where:{id:reservation.attempt.paymentOrderId},data:{status:definitive?"FAILED":"NEEDS_REVIEW",version:{increment:1}}});
   });
  }
 }
 return paymentSummary(db,actor,applicationId);
}

export async function paymentSummary(db:PrismaClient,actor:Actor,applicationId:string){
 const app=await db.application.findFirst({where:{id:applicationId,userId:actor.user.id},select:{id:true,status:true,paymentOrder:{select:{id:true,status:true,amountMinor:true,currency:true,paidAt:true,reviewHold:true,refunds:{where:{status:"COMPLETED"},select:{id:true,amountMinor:true,currency:true,providerReference:true,completedAt:true}},attempts:{select:{id:true,status:true,receiptNumber:true,reviewReason:true,createdAt:true,configuration:{select:{kind:true,label:true,environment:true}}},orderBy:{createdAt:"desc"},take:10}}}}});
 if(!app)throw new AccessError(404,"NOT_FOUND","Application not found");return app;
}

const callbackSchema=z.object({Body:z.object({stkCallback:z.object({MerchantRequestID:z.string().min(1).max(150),CheckoutRequestID:z.string().min(1).max(150),ResultCode:z.number().int().min(0).max(999999),CallbackMetadata:z.object({Item:z.array(z.object({Name:z.string().max(80),Value:z.union([z.string().max(200),z.number()]).optional()})).max(20)}).optional()})})});
type Evidence={checkoutRequestId:string;merchantRequestId:string;amountMinor:number;receipt:string;phone:string};
export async function receivePaymentCallback(db:PrismaClient,token:string,input:unknown){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AccessError(404,"NOT_FOUND","Callback not found");
 const attempt=await db.paymentAttempt.findUnique({where:{callbackTokenHash:hash(token)},include:{paymentOrder:true}});
 if(!attempt)throw new AccessError(404,"NOT_FOUND","Callback not found");
 const callback=callbackSchema.parse(input).Body.stkCallback;
 if(attempt.checkoutRequestId&&attempt.checkoutRequestId!==callback.CheckoutRequestID||attempt.merchantRequestId&&attempt.merchantRequestId!==callback.MerchantRequestID)throw new AccessError(400,"PAYMENT_MISMATCH","Payment identifiers do not match");
 let evidence:Evidence|null=null;
 if(callback.ResultCode===0){
  const items=callback.CallbackMetadata?.Item||[];
  const field=(name:string)=>items.filter(i=>i.Name===name).length===1?items.find(i=>i.Name===name)?.Value:undefined;
  const amount=Number(field("Amount")),phone=String(field("PhoneNumber")??""),receipt=String(field("MpesaReceiptNumber")??"").trim().toUpperCase();
  if(!Number.isSafeInteger(amount*100)||amount*100!==attempt.paymentOrder.amountMinor||!/^254[17]\d{8}$/.test(phone)||!/^\w{10,20}$/.test(receipt)||!attempt.payerCipher||openPaymentSecret<{phone:string}>(attempt.payerCipher,`payer:${attempt.id}`).phone!==phone)throw new AccessError(400,"PAYMENT_MISMATCH","Payment details do not match");
  evidence={checkoutRequestId:callback.CheckoutRequestID,merchantRequestId:callback.MerchantRequestID,amountMinor:amount*100,phone,receipt};
 }
 await db.$transaction(async tx=>{
  await lockPaymentOrder(tx,attempt.paymentOrderId);
  const current=await tx.paymentAttempt.findUniqueOrThrow({where:{id:attempt.id}});
  if(current.checkoutRequestId&&current.checkoutRequestId!==callback.CheckoutRequestID||current.merchantRequestId&&current.merchantRequestId!==callback.MerchantRequestID)throw new AccessError(400,"PAYMENT_MISMATCH","Payment identifiers do not match");
  const deduplicationKey=`callback:${attempt.id}:${hash(JSON.stringify(callback))}`;
  if(await tx.paymentEvent.findUnique({where:{deduplicationKey}}))return;
  await tx.paymentEvent.upsert({where:{deduplicationKey},update:{},create:{deduplicationKey,paymentAttemptId:attempt.id,kind:"stk.callback",resultCode:String(callback.ResultCode),processedAt:new Date()}});
  if(evidence)await tx.paymentAttempt.updateMany({where:{id:attempt.id,status:{in:["PENDING","NEEDS_REVIEW"]}},data:{evidenceCipher:sealPaymentSecret(evidence,`evidence:${attempt.id}`),queryAfter:new Date()}});
  if(evidence&&["FAILED","CANCELLED"].includes(current.status)){
   await tx.paymentAttempt.update({where:{id:attempt.id},data:{evidenceCipher:sealPaymentSecret(evidence,`evidence:${attempt.id}`),reviewReason:"LATE_SUCCESS_EVIDENCE"}});
   await tx.paymentOrder.update({where:{id:attempt.paymentOrderId},data:{reviewHold:true,version:{increment:1}}});
   await tx.paymentReview.create({data:{paymentOrderId:attempt.paymentOrderId,paymentAttemptId:attempt.id,action:"LATE_SUCCESS_EVIDENCE",note:"Success evidence arrived after a failed or cancelled result. Checkout is held pending statement review."}});
  }else if(evidence&&["PENDING","NEEDS_REVIEW"].includes(current.status)){
   await tx.paymentOrder.update({where:{id:attempt.paymentOrderId},data:{version:{increment:1}}});
  }
 });
 return {ResultCode:0,ResultDesc:"Accepted"};
}

export async function reconcileAttempt(db:PrismaClient,id:string,provider:PaymentGateway=gateway){
 const until=new Date(Date.now()+60000);
 const claimed=await db.paymentAttempt.updateMany({where:{id,status:{in:["PENDING","NEEDS_REVIEW"]},queryAfter:{lte:new Date()},OR:[{queryLeaseUntil:null},{queryLeaseUntil:{lt:new Date()}}]},data:{queryLeaseUntil:until,queryAfter:new Date(Date.now()+30000)}});
 if(!claimed.count)return;
 try{
  const attempt=await db.paymentAttempt.findUniqueOrThrow({where:{id},include:{configuration:true,paymentOrder:{include:{application:{select:{userId:true}}}}}});
  if(!attempt.checkoutRequestId||!attempt.configuration){
   if(attempt.createdAt.getTime()<Date.now()-120000)await db.$transaction(async tx=>{
    await lockPaymentOrder(tx,attempt.paymentOrderId);
    const changed=await tx.paymentAttempt.updateMany({where:{id,status:{in:["PENDING","NEEDS_REVIEW"]},OR:[{status:"PENDING"},{reviewReason:null},{reviewReason:{not:"INITIATION_UNCERTAIN"}}]},data:{status:"NEEDS_REVIEW",reviewReason:"INITIATION_UNCERTAIN"}});
    if(changed.count)await tx.paymentOrder.update({where:{id:attempt.paymentOrderId},data:{status:"NEEDS_REVIEW",version:{increment:1}}});
   });
   return;
  }
  if(process.env.NODE_ENV==="production"&&attempt.configuration.environment!=="LIVE")return;
  const result=await provider.query(attempt.configuration,attempt.checkoutRequestId);
  // ResponseCode is an acknowledgement, not the transaction's ResultCode.
  if(result.resultCode===null)return;
  if(result.merchantRequestId&&result.merchantRequestId!==attempt.merchantRequestId)return;
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${attempt.paymentOrder.application.userId} FOR UPDATE`;
   await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${attempt.paymentOrder.applicationId} FOR UPDATE`;
   await tx.$queryRaw`SELECT "id" FROM "PaymentOrder" WHERE "id" = ${attempt.paymentOrderId} FOR UPDATE`;
   await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = (SELECT "jobId" FROM "Application" WHERE "id" = ${attempt.paymentOrder.applicationId}) FOR SHARE`;
   await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = (SELECT "organisationId" FROM "Job" WHERE "id" = (SELECT "jobId" FROM "Application" WHERE "id" = ${attempt.paymentOrder.applicationId})) FOR SHARE`;
   const current=await tx.paymentAttempt.findUniqueOrThrow({where:{id},include:{paymentOrder:{include:{application:{include:{job:{include:{organisation:true}},user:true,documents:{include:{document:true}}}}}}}});
   if(!["PENDING","NEEDS_REVIEW"].includes(current.status)||current.paymentOrder.status==="SUCCEEDED"||current.paymentOrder.status==="REFUNDED")return;
   const app=current.paymentOrder.application, order=current.paymentOrder;
   const deduplicationKey=`query:${id}:${result.resultCode}`;
   await tx.paymentEvent.upsert({where:{deduplicationKey},update:{},create:{deduplicationKey,paymentAttemptId:id,kind:"stk.query",resultCode:result.resultCode,processedAt:new Date()}});
   if(result.resultCode!=="0"){
    await tx.paymentAttempt.update({where:{id},data:{status:result.resultCode==="1032"?"CANCELLED":"FAILED",resultCode:result.resultCode,reviewReason:null}});
    await tx.paymentOrder.update({where:{id:order.id},data:{status:result.resultCode==="1032"?"CANCELLED":"FAILED",version:{increment:1}}});return;
   }
   const evidence=current.evidenceCipher?openPaymentSecret<Evidence>(current.evidenceCipher,`evidence:${id}`):null;
   if(!evidence||evidence.checkoutRequestId!==current.checkoutRequestId||evidence.merchantRequestId!==current.merchantRequestId){
    if(current.status==="NEEDS_REVIEW"&&current.resultCode==="0"&&current.reviewReason==="AWAITING_RECEIPT_EVIDENCE")return;
    await tx.paymentAttempt.update({where:{id},data:{status:"NEEDS_REVIEW",resultCode:"0",reviewReason:"AWAITING_RECEIPT_EVIDENCE"}});
    await tx.paymentOrder.update({where:{id:order.id},data:{status:"NEEDS_REVIEW",version:{increment:1}}});return;
   }
   const duplicate=await tx.paymentAttempt.findFirst({where:{receiptNumber:evidence.receipt,id:{not:id}}});
   if(duplicate){if(current.status==="NEEDS_REVIEW"&&current.reviewReason==="DUPLICATE_RECEIPT")return;await tx.paymentAttempt.update({where:{id},data:{status:"NEEDS_REVIEW",reviewReason:"DUPLICATE_RECEIPT"}});await tx.paymentOrder.update({where:{id:order.id},data:{status:"NEEDS_REVIEW",version:{increment:1}}});return;}
   await settlePayment(tx,id,evidence.receipt,"PROVIDER",app.userId);
  },{timeout:15000});
 }finally{await db.paymentAttempt.updateMany({where:{id,queryLeaseUntil:until},data:{queryLeaseUntil:null}});}
}
export async function refreshPayment(db:PrismaClient,actor:Actor,applicationId:string,provider:PaymentGateway=gateway){
 const summary=await paymentSummary(db,actor,applicationId);
 const latest=summary.paymentOrder?.attempts[0];if(latest)await reconcileAttempt(db,latest.id,provider);
 return paymentSummary(db,actor,applicationId);
}
export async function reconcilePayments(db:PrismaClient,provider:PaymentGateway=gateway){
 const attempts=await db.paymentAttempt.findMany({where:{status:{in:["PENDING","NEEDS_REVIEW"]},queryAfter:{lte:new Date()}},orderBy:{queryAfter:"asc"},take:25,select:{id:true}});
 let processed=0,unavailable=0;for(const attempt of attempts){try{await reconcileAttempt(db,attempt.id,provider);processed++;}catch{unavailable++;}}return {processed,unavailable};
}
