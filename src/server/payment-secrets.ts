import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value=process.env.PAYMENT_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new Error("PAYMENT_ENCRYPTION_KEY must be a separate 32-byte hex key");
  return Buffer.from(value,"hex");
}
export function sealPaymentSecret(value: unknown, context: string) {
  const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key(),iv); cipher.setAAD(Buffer.from(context));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),data.toString("base64url")].join(".");
}
export function openPaymentSecret<T>(value: string, context: string): T {
  const [version,iv,tag,data,...extra]=value.split(".");
  if(version!=="v1" || !iv || !tag || !data || extra.length) throw new Error("Invalid encrypted payment data");
  const cipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,"base64url"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,"base64url")),cipher.final()]).toString("utf8")) as T;
}
