import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatFee } from "@/lib/job-format";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
 const actor = await pageActor(); const raw = Number((await searchParams).page || 1); const page = Number.isInteger(raw) ? Math.min(Math.max(raw,1),100000) : 1;
 const where = { userId: actor.user.id }; const db = getDb();
 const [items,total] = await Promise.all([db.application.findMany({ where, select: { id: true, status: true, applicationFeeMinor: true, updatedAt: true, _count: {select:{responses:true}}, job: { select: { title: true, organisation: { select: { name: true } } } } }, orderBy: [{ updatedAt: "desc" },{ id: "asc" }], skip: (page-1)*20,take:20 }),db.application.count({where})]);
 return <><h1>Your applications</h1><p className="intro">Save your work and return whenever you are ready.</p><Link className="button mb-6" href="/jobs">Find a job</Link><div className="grid gap-4">{items.map(item=><Link className="card block" href={"/dashboard/applications/"+item.id} key={item.id}><h2>{item.job.title}</h2><p>{item.job.organisation.name}</p><p className="hint">{applicationStatusLabels[item.status]} · Application fee {formatFee(item.applicationFeeMinor)}</p><p className="hint">{item._count.responses} response(s) and updates</p></Link>)}{!items.length && <p>No applications on this page yet.</p>}</div><nav className="mt-6 flex gap-6" aria-label="Applications pages">{page>1 && <Link href={"?page="+(page-1)}>Previous</Link>}{page*20<total && <Link href={"?page="+(page+1)}>Next</Link>}</nav></>;
}

