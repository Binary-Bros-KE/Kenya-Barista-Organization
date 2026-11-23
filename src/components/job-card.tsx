import Link from "next/link";
import { VerifiedBadge, VerifiedRibbon } from "./verified-badge";
import { JobCover } from "./job-cover";
import { avatarSrc } from "@/lib/images";
import { categories, employmentTypes, formatDeadline, formatFee } from "@/lib/job-format";
import type { listPublicJobs } from "@/server/public-jobs";
type PublicJob = Awaited<ReturnType<typeof listPublicJobs>>["jobs"][number];
export function JobCard({job}:{job:PublicJob}) {return <article className="career-job-card">{job.employer.verified && <VerifiedRibbon />}<JobCover id={job.id} coverVersion={job.coverVersion} category={job.category} /><div className="career-tags"><span>{categories[job.category as keyof typeof categories]||job.category}</span><span>{employmentTypes[job.employmentType as keyof typeof employmentTypes]||job.employmentType}</span></div><p className="career-employer"><EmployerLogo employer={job.employer} />{job.employer.name}{job.employer.verified && <> <VerifiedBadge /></>}</p><h2><Link href={'/jobs/'+job.slug}>{job.title}</Link></h2><p className="career-location">{job.location}</p><p className="career-summary">{job.summary}{job.summary.length===200?"...":""}</p><dl><div><dt>Deadline &middot; Nairobi</dt><dd>{formatDeadline(job.deadline)}</dd></div><div><dt>Application fee</dt><dd>{formatFee(job.applicationFeeMinor)}</dd></div></dl><Link href={'/jobs/'+job.slug} className="career-job-link">View opportunity <span aria-hidden="true">&#8599;</span></Link></article>;}

// The recruiter's profile photo, shown as a small logo next to the employer name.
export function EmployerLogo({employer}:{employer:{id:string;avatarVersion:number|null}}) {const src=avatarSrc(employer.id,employer.avatarVersion,24);return src?<img className="career-employer-logo" src={src} alt="" loading="lazy"/>:null;}
