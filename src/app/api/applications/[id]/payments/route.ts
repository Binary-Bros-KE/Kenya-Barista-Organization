import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { initiatePayment, paymentSummary } from "@/server/payments";
type Context={params:Promise<{id:string}>};
export const runtime="nodejs";
export async function GET(request:Request,context:Context){return api(request,async actor=>paymentSummary(getDb(),actor,(await context.params).id));}
export async function POST(request:Request,context:Context){return api(request,async actor=>initiatePayment(getDb(),actor,(await context.params).id,await jsonInput(request)));}

