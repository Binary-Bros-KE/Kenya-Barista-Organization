import Link from "next/link";
import { notFound } from "next/navigation";
import { jobPageActor } from "@/lib/job-page-access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
import { getReviewApplication,reviewResponses } from "@/server/recruitment";
import { RecruitmentActions } from "@/components/recruitment-actions";
import { ApplicationResponses } from "@/components/application-responses";
import { applicationStatusLabels } from "@/lib/application-format";
import { AccessError } from "@/server/errors";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{responsePage?:string}>}){
 const actor=await jobPageActor(),db=getDb(),{id}=await params;let app;
 try{app=await getReviewApplication(db,actor,id);}catch(error){if(error instanceof AccessError&&error.status===404)notFound();if(error instanceof AccessError&&error.status===409)return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><h1>Application unavailable</h1><p className="notice error">{error.message}</p><Link href="/employer/applications">Back to applications</Link></Workspace>;throw error;}
 const rawPage=Number((await searchParams).responsePage||1),page=Number.isInteger(rawPage)?Math.min(Math.max(rawPage,1),100000):1;
 const responses=await reviewResponses(db,actor,id,page);
 return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><Link className="underline" href="/employer/applications">All applications</Link><h1 className="mt-6">{app.profile.fullName}</h1><p className="intro">{app.profile.jobTitle} · {app.profile.organisationName}</p><p className="badge mb-6">{applicationStatusLabels[app.status]}</p>
 <div className="grid gap-6 lg:grid-cols-2"><section className="card form-stack"><h2>Submitted profile</h2><p>{app.profile.email}</p><p>{app.profile.phone} · {app.profile.location}</p><p className="whitespace-pre-wrap break-words">{app.profile.summary||"No summary provided."}</p><h3>Cover letter</h3><p className="whitespace-pre-wrap break-words">{app.profile.coverLetter||"No cover letter provided."}</p>{app.cv.available?<a className="button" href={"/api/employer/applications/"+id+"/cv"}>Download submitted CV</a>:<p className="notice">The submitted CV is currently unavailable.</p>}<p className="hint">These are the details captured when the application was submitted.</p></section><RecruitmentActions id={id} version={app.version} status={app.status} paused={!!app.job.organisation.suspendedAt} /></div><ApplicationResponses result={responses} /></Workspace>;
}

