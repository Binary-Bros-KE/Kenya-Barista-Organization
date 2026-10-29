import Link from "next/link";
import { jobPageActor } from "@/lib/job-page-access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
import { listReviewApplications,reviewJobOptions } from "@/server/recruitment";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatDeadline } from "@/lib/job-format";
import { AccessError } from "@/server/errors";
import { ZodError } from "zod";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;jobId?:string;page?:string}>}){
 const actor=await jobPageActor(),query=await searchParams,db=getDb();
 const input=Object.fromEntries(Object.entries(query).filter(([,value])=>value!==undefined&&value!==""));let result;
 try{result=await listReviewApplications(db,actor,input);}catch(error){if(error instanceof AccessError||!(error instanceof ZodError))throw error;return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><h1>Review applications</h1><p className="notice error">Check your search filters.</p><Link href="/employer/applications">Clear filters</Link></Workspace>;}
 const jobs=await reviewJobOptions(db,actor);
 const link=(page:number)=>{const params=new URLSearchParams(input as Record<string,string>);params.set("page",String(page));return "?"+params.toString();};
 return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><h1>Review applications</h1><p className="intro">Review confirmed submissions and keep applicants informed.</p>
 <form className="card mb-6 grid items-end gap-4 md:grid-cols-4"><label>Job title or applicant email<input name="q" maxLength={120} defaultValue={query.q||""} /></label><label>Job<select name="jobId" defaultValue={query.jobId||""}><option value="">All jobs</option>{jobs.map(job=><option key={job.id} value={job.id}>{job.title} · {job.organisation.name}</option>)}</select></label><label>Status<select name="status" defaultValue={query.status||""}><option value="">All submitted applications</option>{Object.entries(applicationStatusLabels).filter(([key])=>key!=="DRAFT").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button className="button">Filter</button></form>
 <p className="hint mb-4">{result.pagination.total} application(s)</p><div className="grid gap-4">{result.applications.map(app=><Link className="card block" href={"/employer/applications/"+app.id} key={app.id}><div className="flex flex-wrap justify-between gap-3"><h2>{app.applicantName}</h2><span className="badge">{applicationStatusLabels[app.status]}</span></div><p>{app.job.title} · {app.job.organisation.name}</p><p className="hint">{app.submittedAt?formatDeadline(app.submittedAt):""}</p></Link>)}{!result.applications.length&&<p>No confirmed submissions match these filters.</p>}</div><nav className="mt-6 flex gap-6" aria-label="Application review pages">{result.pagination.page>1&&<Link href={link(result.pagination.page-1)}>Previous</Link>}{result.pagination.page<result.pagination.pageCount&&<Link href={link(result.pagination.page+1)}>Next</Link>}</nav></Workspace>;
}

