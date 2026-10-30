import { notFound } from "next/navigation";
import { CareerFrame, ApplicationEntryContent } from "@/components/recruitment-public";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getPublicJob } from "@/server/public-jobs";
import { AccessError } from "@/server/errors";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 const {slug}=await params; await pageActor(false,`/jobs/${slug}/apply`); let job;
 try { job=await getPublicJob(getDb(),slug); } catch(e) { if(e instanceof AccessError && e.status===404) notFound(); throw e; }
 return <CareerFrame><ApplicationEntryContent job={job}/></CareerFrame>;
}
