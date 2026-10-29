import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { formatFee } from "@/lib/job-format";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
 const actor=await pageActor(),raw=Number((await searchParams).page||1),page=Number.isInteger(raw)?Math.min(Math.max(raw,1),100000):1;
 const where={application:{userId:actor.user.id}},db=getDb();
 const [orders,total]=await Promise.all([db.paymentOrder.findMany({where,select:{id:true,status:true,amountMinor:true,paidAt:true,refunds:{where:{status:"COMPLETED"},select:{id:true,providerReference:true,completedAt:true}},application:{select:{id:true,job:{select:{title:true}}}},attempts:{select:{receiptNumber:true},orderBy:{createdAt:"desc"},take:1}},orderBy:[{createdAt:"desc"},{id:"asc"}],skip:(page-1)*20,take:20}),db.paymentOrder.count({where})]);
 return <><h1>Your payments</h1><p className="intro">Track application fees and payment receipts.</p><div className="grid gap-4">{orders.map(order=><Link className="card block" key={order.id} href={"/dashboard/applications/"+order.application.id}><h2>{order.application.job.title}</h2><p>{formatFee(order.amountMinor)} · {order.status==="REFUNDED"?"REVERSED":order.status.replaceAll("_"," ")}</p>{order.refunds.map(refund=><p key={refund.id}>Manual reversal recorded  -  Reference: {refund.providerReference}</p>)}{order.attempts[0]?.receiptNumber&&<p>Receipt: {order.attempts[0].receiptNumber}</p>}</Link>)}{!orders.length&&<p>No payments on this page yet.</p>}</div><nav className="mt-6 flex gap-6" aria-label="Payment pages">{page>1&&<Link href={"?page="+(page-1)}>Previous</Link>}{page*20<total&&<Link href={"?page="+(page+1)}>Next</Link>}</nav></>;
}
