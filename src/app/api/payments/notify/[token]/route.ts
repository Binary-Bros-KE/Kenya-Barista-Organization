import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { receivePaymentCallback } from "@/server/payments";
import { AccessError } from "@/server/errors";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{token:string}>}){
 const headers={"Cache-Control":"no-store"};
 try{return Response.json(await receivePaymentCallback(getDb(),(await context.params).token,await jsonInput(request)),{headers});}
 catch(error){
 if(error instanceof AccessError)return Response.json({message:error.message},{status:error.status,headers});
 if(error instanceof ZodError)return Response.json({message:"Invalid callback"},{status:400,headers});
 logEvent("error","payments.callback_failed",randomUUID());return Response.json({message:"Callback unavailable"},{status:503,headers});
 }
}

