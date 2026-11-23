import Link from "next/link";
import { jobPageActor } from "@/lib/job-page-access";
import { getDb } from "@/lib/db";
import { listReviewApplications,recruitmentScope,reviewJobOptions } from "@/server/recruitment";
import { OpenApplicant } from "@/components/applicant-popup";
import { ReviewApplications } from "@/components/review-applications";
import { AccessError } from "@/server/errors";
import { ZodError } from "zod";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;jobId?:string;page?:string;open?:string}>}){
 const actor=await jobPageActor(),query=await searchParams,db=getDb();
 const input=Object.fromEntries(Object.entries(query).filter(([key,value])=>key!=="open"&&value!==undefined&&value!==""));
 // ?open=<id> (links from emails and the dashboard) opens that applicant in the popup, if this account may see it.
 const opening=query.open?await db.application.findFirst({where:{id:query.open,...recruitmentScope(actor)},select:{id:true,job:{select:{id:true,title:true}}}}):null;let result;
 try{result=await listReviewApplications(db,actor,input);}catch(error){if(error instanceof AccessError||!(error instanceof ZodError))throw error;return <><div className="employer-workspace"><div className="employer-feedback is-error">Check your search filters. <Link href="/employer/applications">Clear filters</Link></div></div></>;}
 const jobs=await reviewJobOptions(db,actor);
 return <><div className="employer-workspace">{opening&&<OpenApplicant application={opening}/>}<ReviewApplications result={result} query={{q:query.q,status:query.status,jobId:query.jobId}} jobs={jobs}/></div></>;
}
