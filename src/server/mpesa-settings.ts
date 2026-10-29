import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { openPaymentSecret, sealPaymentSecret } from "./payment-secrets";

const shortcode=z.string().regex(/^\d{4,10}$/);
const secret=z.string().trim().min(8).max(512);
export const credentialsInput=z.object({consumerKey:secret,consumerSecret:secret,passkey:secret}).strict();
export type MpesaCredentials=z.infer<typeof credentialsInput>;
const inputSchema=z.object({kind:z.enum(["PAYBILL","TILL"]),environment:z.enum(["SANDBOX","LIVE"]),label:z.string().trim().min(2).max(80),businessShortCode:shortcode,tillNumber:shortcode.nullable(),enabled:z.boolean(),credentials:credentialsInput.optional()}).strict().superRefine((v,ctx)=>{if(v.kind==="TILL"&&!v.tillNumber)ctx.addIssue({code:"custom",message:"Till number is required",path:["tillNumber"]});if(v.kind==="PAYBILL"&&v.tillNumber)ctx.addIssue({code:"custom",message:"Paybill does not use a Till number",path:["tillNumber"]});});
export const safeConfigSelect={id:true,label:true,kind:true,environment:true,businessShortCode:true,tillNumber:true,enabled:true,createdAt:true} as const;
export async function listMpesaSettings(db:PrismaClient,actor:Actor){assertAdmin(actor);return db.mpesaConfiguration.findMany({select:safeConfigSelect,orderBy:{createdAt:"desc"},take:50});}
export async function saveMpesaSettings(db:PrismaClient,actor:Actor,input:unknown){
 assertAdmin(actor);const data=inputSchema.parse(input);
 return db.$transaction(async tx=>{
  await tx.mpesaSettingsLock.upsert({where:{id:"platform"},create:{id:"platform"},update:{}});
  await tx.$queryRaw`SELECT "id" FROM "MpesaSettingsLock" WHERE "id" = 'platform' FOR UPDATE`;
  const previous=await tx.mpesaConfiguration.findFirst({where:{kind:data.kind,environment:data.environment},orderBy:{createdAt:"desc"}});
  const credentials=data.credentials ?? (previous ? openPaymentSecret<MpesaCredentials>(previous.credentialsCipher,`mpesa:${previous.id}`) : credentialsInput.parse(undefined));
  const id=randomUUID();
  await tx.mpesaConfiguration.updateMany({where:{kind:data.kind,enabled:true},data:{enabled:false}});
  // Each edit creates an immutable credential revision. Pending requests keep their original merchant.
  const result=await tx.mpesaConfiguration.create({data:{id,label:data.label,kind:data.kind,environment:data.environment,businessShortCode:data.businessShortCode,tillNumber:data.tillNumber,enabled:data.enabled,credentialsCipher:sealPaymentSecret(credentials,`mpesa:${id}`)},select:safeConfigSelect});
  await tx.auditLog.create({data:{actorId:actor.user.id,action:"payments.configuration_saved",entityType:"MpesaConfiguration",entityId:id}});
  return result;
 });
}
export async function paymentOptions(db:PrismaClient){return db.mpesaConfiguration.findMany({where:{enabled:true,...(process.env.NODE_ENV==="production"?{environment:"LIVE" as const}:{})},select:{id:true,label:true,kind:true,environment:true,businessShortCode:true,tillNumber:true},orderBy:{kind:"asc"}});}
