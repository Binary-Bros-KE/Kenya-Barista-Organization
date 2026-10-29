import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/lib/db";
import { categories, employmentTypes, formatDeadline, formatFee } from "@/lib/job-format";
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
  return <PublicShell><main className="py-12"><Link href="/jobs" className="text-sm underline">← All opportunities</Link><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]"><article><p className="mb-4 text-sm font-semibold text-emerald-900">{job.organisation.name}</p><h1>{job.title}</h1><p className="intro">{job.location} · {employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</p><div className="mb-8 flex flex-wrap gap-3"><span className="badge">{categories[job.category as keyof typeof categories] || job.category}</span><span className="badge">{job.isOpen ? "Open opportunity" : "Applications closed"}</span></div><section className="card"><h2>About this opportunity</h2><p className="mt-5 whitespace-pre-wrap leading-8 text-stone-700">{job.description}</p></section></article><aside className="card h-fit form-stack"><h2>Application details</h2><div><p className="hint">Application deadline</p><p className="mt-1 text-sm font-medium">{formatDeadline(job.deadline)}</p><p className="hint">Africa/Nairobi time</p></div><div><p className="hint">Application fee</p><p className="mt-1 text-2xl font-semibold">{formatFee(job.applicationFeeMinor)}</p><p className="hint mt-2">Payment does not guarantee employment.</p></div><p className={`notice ${job.isOpen ? "success" : "error"}`}>{job.isOpen ? "Prepare your application and pay securely through M-Pesa." : "This opportunity is no longer accepting applications."}</p>{job.isOpen && <Link className="button" href={`/jobs/${job.slug}/apply`}>Apply for this job</Link>}</aside></div></main></PublicShell>;
}
