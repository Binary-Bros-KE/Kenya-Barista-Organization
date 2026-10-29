import { z } from "zod";
import type { MpesaConfiguration } from "../generated/prisma/client";
import { openPaymentSecret } from "./payment-secrets";
import type { MpesaCredentials } from "./mpesa-settings";

export function darajaTimestamp(date=new Date()) {
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;return ["year","month","day","hour","minute","second"].map(get).join("");
}
export function stkPayload(config:Pick<MpesaConfiguration,"kind"|"businessShortCode"|"tillNumber">,passkey:string,phone:string,amountMinor:number,callback:string,reference:string,date=new Date()){
 if(!Number.isSafeInteger(amountMinor)||amountMinor<100||amountMinor%100!==0||amountMinor>25000000)throw new Error("M-Pesa requires whole KES between 1 and 250000");
 if(!/^254[17]\d{8}$/.test(phone))throw new Error("Invalid payer phone");
 if(config.kind==="TILL"&&!config.tillNumber)throw new Error("Missing Till number");
 const Timestamp=darajaTimestamp(date);
 return {BusinessShortCode:config.businessShortCode,Password:Buffer.from(config.businessShortCode+passkey+Timestamp).toString("base64"),Timestamp,TransactionType:config.kind==="TILL"?"CustomerBuyGoodsOnline":"CustomerPayBillOnline",Amount:amountMinor/100,PartyA:phone,PartyB:config.kind==="TILL"?config.tillNumber!:config.businessShortCode,PhoneNumber:phone,CallBackURL:callback,AccountReference:reference.replace(/[^a-zA-Z0-9]/g,"").slice(0,12),TransactionDesc:"Job fee"};
}
export class DarajaError extends Error { constructor(public definitive=false){super("Payment provider request could not be completed");} }
export interface PaymentGateway {
 initiate(config:MpesaConfiguration,phone:string,amountMinor:number,callback:string,reference:string):Promise<{checkoutRequestId:string;merchantRequestId:string}>;
 query(config:MpesaConfiguration,checkoutRequestId:string):Promise<{resultCode:string|null;merchantRequestId?:string}>;
}
export class DarajaGateway implements PaymentGateway {
 constructor(private readonly request:typeof fetch=fetch){}
 private base(config:MpesaConfiguration){return config.environment==="LIVE"?"https://api.safaricom.co.ke":"https://sandbox.safaricom.co.ke";}
 private async json(url:string,init:RequestInit){
  try {const response=await this.request(url,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});const body:unknown=await response.json();if(!response.ok)throw new DarajaError(false);return body;}
  catch(error){if(error instanceof DarajaError)throw error;throw new DarajaError(false);}
 }
 private async token(config:MpesaConfiguration){
  const credentials=openPaymentSecret<MpesaCredentials>(config.credentialsCipher,`mpesa:${config.id}`);
  const data=await this.json(this.base(config)+"/oauth/v1/generate?grant_type=client_credentials",{headers:{Authorization:"Basic "+Buffer.from(credentials.consumerKey+":"+credentials.consumerSecret).toString("base64")}});
  return z.object({access_token:z.string().min(1).max(4096)}).parse(data).access_token;
 }
 async initiate(config:MpesaConfiguration,phone:string,amountMinor:number,callback:string,reference:string){
  let token:string;try{token=await this.token(config);}catch{throw new DarajaError(true);}
  const credentials=openPaymentSecret<MpesaCredentials>(config.credentialsCipher,`mpesa:${config.id}`);
  const body=await this.json(this.base(config)+"/mpesa/stkpush/v1/processrequest",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(stkPayload(config,credentials.passkey,phone,amountMinor,callback,reference))});
  const result=z.object({ResponseCode:z.union([z.string(),z.number()]).transform(String),CheckoutRequestID:z.string().min(1).max(150).optional(),MerchantRequestID:z.string().min(1).max(150).optional()}).safeParse(body);
  if(!result.success)throw new DarajaError(false);
  if(result.data.ResponseCode!=="0")throw new DarajaError(true);
  if(!result.data.CheckoutRequestID||!result.data.MerchantRequestID)throw new DarajaError(false);
  return {checkoutRequestId:result.data.CheckoutRequestID,merchantRequestId:result.data.MerchantRequestID};
 }
 async query(config:MpesaConfiguration,checkoutRequestId:string){
  const token=await this.token(config), credentials=openPaymentSecret<MpesaCredentials>(config.credentialsCipher,`mpesa:${config.id}`),Timestamp=darajaTimestamp();
  const body=await this.json(this.base(config)+"/mpesa/stkpushquery/v1/query",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({BusinessShortCode:config.businessShortCode,Password:Buffer.from(config.businessShortCode+credentials.passkey+Timestamp).toString("base64"),Timestamp,CheckoutRequestID:checkoutRequestId})});
  const result=z.object({ResponseCode:z.union([z.string(),z.number()]).transform(String).optional(),ResultCode:z.union([z.string(),z.number()]).transform(String).optional(),CheckoutRequestID:z.string().optional(),MerchantRequestID:z.string().optional()}).parse(body);
  if(result.CheckoutRequestID&&result.CheckoutRequestID!==checkoutRequestId)throw new DarajaError(false);
  return {resultCode:result.ResultCode&&/^\d{1,6}$/.test(result.ResultCode)?result.ResultCode:null,merchantRequestId:result.MerchantRequestID};
 }
}
