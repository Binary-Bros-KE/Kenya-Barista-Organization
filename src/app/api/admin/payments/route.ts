import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
export async function GET(request:Request){return api(request,async()=>getDb().paymentOrder.findMany({select:{id:true,status:true,amountMinor:true,paidAt:true,createdAt:true,application:{select:{id:true,user:{select:{email:true}},job:{select:{title:true}}}},attempts:{select:{id:true,status:true,resultCode:true,receiptNumber:true,reviewReason:true,configuration:{select:{label:true,kind:true,environment:true}}},orderBy:{createdAt:"desc"},take:1}},orderBy:{createdAt:"desc"},take:100}),true);}

