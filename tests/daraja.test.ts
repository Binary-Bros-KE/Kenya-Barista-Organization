import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { stkPayload, darajaTimestamp, DarajaGateway } from "../src/server/daraja";
import { sealPaymentSecret, openPaymentSecret } from "../src/server/payment-secrets";
import type { MpesaConfiguration } from "../src/generated/prisma/client";

test("Paybill and Till use different transaction types and credit parties",()=>{
 const date=new Date("2026-10-16T20:59:00Z");assert.equal(darajaTimestamp(date),"20261016235900");
 const config={businessShortCode:"654321",kind:"PAYBILL" as const,tillNumber:null};
 const paybill=stkPayload(config,"passkey","254712345678",10000,"https://example.test/notify","ABC123",date);
 assert.equal(paybill.TransactionType,"CustomerPayBillOnline");assert.equal(paybill.PartyB,"654321");assert.equal(paybill.Amount,100);
 const till=stkPayload({...config,kind:"TILL",tillNumber:"7654321"},"passkey","254712345678",10000,"https://example.test/notify","ABC123",date);
 assert.equal(till.TransactionType,"CustomerBuyGoodsOnline");assert.equal(till.BusinessShortCode,"654321");assert.equal(till.PartyB,"7654321");assert.equal(Buffer.from(till.Password,"base64").toString(),"654321passkey20261016235900");
 assert.throws(()=>stkPayload({...config,kind:"TILL"},"x","254712345678",10000,"https://example.test","ref"));
 for(const amount of [0,99,101,25000100])assert.throws(()=>stkPayload(config,"x","254712345678",amount,"https://example.test","ref"));
});
test("payment encryption authenticates the ciphertext and its owning record",()=>{
 process.env.PAYMENT_ENCRYPTION_KEY=randomBytes(32).toString("hex");const secret={consumerKey:"private",consumerSecret:"very-private"};
 const encrypted=sealPaymentSecret(secret,"merchant:one");assert.ok(!encrypted.includes("private"));assert.deepEqual(openPaymentSecret(encrypted,"merchant:one"),secret);
 assert.throws(()=>openPaymentSecret(encrypted,"merchant:two"));const parts=encrypted.split(".");parts[2]=Buffer.alloc(16).toString("base64url");assert.throws(()=>openPaymentSecret(parts.join("."),"merchant:one"));
});
test("Daraja transport uses fixed hosts, OAuth, and ResultCode rather than acknowledgement",async()=>{
 process.env.PAYMENT_ENCRYPTION_KEY=randomBytes(32).toString("hex");
 const config={id:"test-config",kind:"TILL",environment:"SANDBOX",businessShortCode:"654321",tillNumber:"7654321",credentialsCipher:sealPaymentSecret({consumerKey:"test-key",consumerSecret:"test-secret",passkey:"test-passkey"},"mpesa:test-config")} as MpesaConfiguration;
 const calls:{url:string;init:RequestInit}[]=[];let queryResult:unknown={ResponseCode:"0"};
 const provider=new DarajaGateway((async(url: string|URL|Request,init:RequestInit)=>{calls.push({url:String(url),init});return Response.json(String(url).includes("oauth")?{access_token:"test-token"}:String(url).includes("processrequest")?{ResponseCode:"0",CheckoutRequestID:"checkout",MerchantRequestID:"merchant"}:queryResult);}) as typeof fetch);
 assert.deepEqual(await provider.initiate(config,"254712345678",10000,"https://example.test/notify","ref"),{checkoutRequestId:"checkout",merchantRequestId:"merchant"});
 assert.ok(calls[0].url.startsWith("https://sandbox.safaricom.co.ke/oauth/"));assert.equal((calls[0].init.headers as Record<string,string>).Authorization,"Basic "+Buffer.from("test-key:test-secret").toString("base64"));
 assert.equal(JSON.parse(String(calls[1].init.body)).PartyB,"7654321");assert.equal((await provider.query(config,"checkout")).resultCode,null);
 queryResult={ResponseCode:"0",ResultCode:0,CheckoutRequestID:"checkout",MerchantRequestID:"merchant"};assert.equal((await provider.query(config,"checkout")).resultCode,"0");
 queryResult={ResultCode:0,CheckoutRequestID:"wrong-request"};await assert.rejects(provider.query(config,"checkout"));
});
