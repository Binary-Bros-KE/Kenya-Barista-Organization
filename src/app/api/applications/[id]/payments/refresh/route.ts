import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { refreshPayment } from "@/server/payments";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return api(request,async actor=>refreshPayment(getDb(),actor,(await context.params).id));}

