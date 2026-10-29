import { EmployerHeading } from "@/components/employer-ui";
import { formatDeadline } from "@/lib/job-format";
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
 try{app=await getReviewApplication(db,actor,id);}catch(error){if(error instanceof AccessError&&error.status===404)notFound();if(error instanceof AccessError&&error.status===409)return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><div className="employer-workspace"><EmployerHeading title="Application unavailable" description="This submission needs attention before it can be reviewed."/><p className="employer-feedback is-error">{error.message}</p><Link className="employer-secondary" href="/employer/applications">Back to applications</Link></div></Workspace>;throw error;}
 const rawPage=Number((await searchParams).responsePage||1),page=Number.isInteger(rawPage)?Math.min(Math.max(rawPage,1),100000):1;
 const responses=await reviewResponses(db,actor,id,page);
 return <Workspace name={actor.user.name||actor.user.email} admin={actor.user.role==="ADMIN"}><div className="employer-workspace"><EmployerHeading title={app.profile.fullName} description={app.profile.jobTitle+" - "+app.profile.organisationName} eyebrow="CANDIDATE APPLICATION" back={{href:"/employer/applications",label:"All applications"}}/><div className="employer-candidate-banner"><span className={"application-status status-"+app.status.toLowerCase()}>{applicationStatusLabels[app.status]}</span><p>{app.submittedAt?"Submitted "+formatDeadline(app.submittedAt)+" - Nairobi time":"Submitted application"}</p><span>Saved submission details</span></div>
 <div className="employer-candidate-layout"><section className="employer-panel employer-submitted-profile"><div className="employer-section-heading"><div><span className="employer-eyebrow">MEET YOUR CANDIDATE</span><h2>Submitted profile</h2></div></div><dl className="employer-contact"><div><dt>Email address</dt><dd>{app.profile.email}</dd></div><div><dt>Mobile number</dt><dd>{app.profile.phone}</dd></div><div><dt>Location</dt><dd>{app.profile.location}</dd></div></dl><div className="employer-profile-section"><h3>Professional summary</h3><p>{app.profile.summary||"No summary provided."}</p></div><div className="employer-profile-section"><h3>Cover letter</h3><p>{app.profile.coverLetter||"No cover letter provided."}</p></div><div className="employer-cv-download"><div><h3>Submitted CV</h3><p>{app.cv.filename}</p></div>{app.cv.available?<a className="employer-secondary" href={"/api/employer/applications/"+id+"/cv"}>Download CV &#8595;</a>:<p className="employer-inline-warning">The submitted CV is currently unavailable.</p>}</div><p className="employer-footnote">These details were captured when the application was submitted. Profile updates do not replace the submitted record.</p></section><RecruitmentActions id={id} version={app.version} status={app.status} paused={!!app.job.organisation.suspendedAt}/></div><ApplicationResponses result={responses}/></div></Workspace>;
}
