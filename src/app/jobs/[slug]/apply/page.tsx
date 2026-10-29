import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { StartApplication } from "@/components/applicant-forms";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getPublicJob } from "@/server/public-jobs";
import { AccessError } from "@/server/errors";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 await pageActor(); const {slug}=await params; let job;
 try { job=await getPublicJob(getDb(),slug); } catch(e) { if(e instanceof AccessError && e.status===404) notFound(); throw e; }
 return <PublicShell><main className="py-12"><h1>Apply for {job.title}</h1><p className="intro">{job.organisation.name}</p>{job.isOpen ? <StartApplication slug={slug} /> : <p>Applications are closed.</p>}<p className="hint mt-6">Save your profile, attach your CV, and complete the application fee using M-Pesa. Your application is submitted after payment is verified.</p></main></PublicShell>;
}

