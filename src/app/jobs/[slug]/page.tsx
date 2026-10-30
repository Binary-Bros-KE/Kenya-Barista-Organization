import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CareerFrame, JobDetailContent } from "@/components/recruitment-public";
import { getDb } from "@/lib/db";
import { getPublicJob } from "@/server/public-jobs";
import { AccessError } from "@/server/errors";
export const dynamic = "force-dynamic";
const readJob = cache(async (slug: string) => getPublicJob(getDb(), slug));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try { const job = await readJob((await params).slug); return { title: `${job.title} at ${job.organisation.name}`, description: job.description.slice(0, 160), openGraph: { title: `${job.title} at ${job.organisation.name}`, description: job.description.slice(0, 160) } }; }
  catch (error) { if (error instanceof AccessError && error.status === 404) return { title: "Job not found" }; throw error; }
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  let job;
  try { job = await readJob((await params).slug); }
  catch (error) { if (error instanceof AccessError && error.status === 404) notFound(); throw error; }
  return <CareerFrame><JobDetailContent job={job}/></CareerFrame>;
}
