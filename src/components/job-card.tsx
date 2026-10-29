import Link from "next/link";
import { categories, employmentTypes, formatDeadline, formatFee } from "@/lib/job-format";
import type { listPublicJobs } from "@/server/public-jobs";
type PublicJob = Awaited<ReturnType<typeof listPublicJobs>>["jobs"][number];
export function JobCard({ job }: { job: PublicJob }) {
  return <article className="card flex flex-col gap-4"><div className="flex flex-wrap gap-2 text-xs"><span className="badge">{categories[job.category as keyof typeof categories] || job.category}</span><span className="badge">{employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</span></div><div><p className="mb-2 text-sm text-stone-600">{job.organisation.name} · {job.location}</p><h2 className="text-xl"><Link href={`/jobs/${job.slug}`} className="hover:underline">{job.title}</Link></h2></div><p className="flex-1 text-sm leading-7 text-stone-600">{job.summary}{job.summary.length === 200 ? "…" : ""}</p><div className="border-t border-stone-200 pt-4 text-xs leading-6 text-stone-600"><p>Deadline: {formatDeadline(job.deadline)} (Nairobi)</p><p>Application fee: <strong className="text-stone-800">{formatFee(job.applicationFeeMinor)}</strong></p></div><Link href={`/jobs/${job.slug}`} className="font-semibold text-emerald-900">View opportunity →</Link></article>;
}
