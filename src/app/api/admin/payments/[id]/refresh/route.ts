import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import { reconcileAttempt } from "@/server/payments";
import { AccessError } from "@/server/errors";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 return api(request,async()=>{
  const db=getDb(),order=await db.paymentOrder.findUnique({where:{id:(await context.params).id},select:{attempts:{select:{id:true},orderBy:{createdAt:"desc"},take:1}}});
  if(!order)throw new AccessError(404,"NOT_FOUND","Payment order not found");
  if(order.attempts[0])await reconcileAttempt(db,order.attempts[0].id);
  return {checked:true};
 },true);
}
