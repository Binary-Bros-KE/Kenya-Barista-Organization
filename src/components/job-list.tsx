"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreateJobButton } from "./job-create-modal";
import { FeeSettings } from "./fee-settings";
import { JobManageModal } from "./job-manage-modal";
import { JobApplicantsModal } from "./job-applicants";
import { avatarSrc } from "@/lib/images";
import { initialsOf } from "./profile-card";
import { statusLabels, formatDeadline, formatFee, categories, employmentTypes } from "@/lib/job-format";
import { JobCover } from "./job-cover";
import { EmployerLogo } from "./job-card";
import { VerifiedBadge, VerifiedRibbon } from "./verified-badge";
type Row = { id: string; title: string; status: keyof typeof statusLabels; deadline: string; applicationFeeMinor: number; coverVersion: number | null; category: string; employmentType: string; location: string; summary: string; recruiter: { id: string; name: string | null; avatarVersion: number | null; recruiterVerifiedAt: string | null }; _count: { applications: number }; newApplicants?: number; recentApplicants?: { id: string; name: string | null; avatarVersion: number | null }[] };
// With onManage, the title and "Manage posting" open the manage popup; without it they link to the job page.
// With onApplicants, the card shows applicant photos and opens the applicants popup; without it, it links to the applicants page.
export function ManagedJobCards({ jobs, admin = false, onManage, onApplicants }: { jobs: Row[]; admin?: boolean; onManage?: (id: string) => void; onApplicants?: (job: Row) => void }) {
 const href = (id: string) => "/" + (admin ? "admin" : "employer") + "/jobs/" + id;
 const open = (id: string, className: string | undefined, children: React.ReactNode) => onManage ? <button type="button" className={className ? className + " is-button" : "employer-job-title-button"} onClick={() => onManage(id)}>{children}</button> : <Link className={className} href={href(id)}>{children}</Link>;
 // Same design as the Find jobs cards: cover, fee, status, category colour, and the Verified ribbon for verified recruiters.
 return <ul className="djobs-grid managed-job-grid">{jobs.map(job => { const passed = job.status === "PUBLISHED" && new Date(job.deadline) <= new Date(), verified = !!job.recruiter.recruiterVerifiedAt;
  return <li key={job.id}><article className={`djobs-card managed-job-card is-${job.category.toLowerCase()} status-${job.status.toLowerCase()}`}>
   {verified && <VerifiedRibbon />}
   <span className="djobs-card-media"><JobCover id={job.id} coverVersion={job.coverVersion} category={job.category} /><span className="djobs-card-fee">{formatFee(job.applicationFeeMinor)}</span><span className={"djobs-card-status status-" + job.status.toLowerCase()}>{statusLabels[job.status]}</span></span>
   <div className="djobs-card-body">{job.status === "PENDING_REVIEW" && <span className="managed-job-flag">{admin ? "Needs your review" : "Waiting for KBO review"}</span>}{job.status === "CHANGES_REQUESTED" && <span className="managed-job-flag">{admin ? "Sent back to the recruiter" : "KBO asked for changes"}</span>}
    <span className="djobs-card-employer"><EmployerLogo employer={{ id: job.recruiter.id, avatarVersion: job.recruiter.avatarVersion }} />{job.recruiter.name || "KBO recruiter"}{verified && <VerifiedBadge />}</span>
    <h3 className="managed-job-title">{open(job.id, undefined, job.title)}</h3>
    <span className="djobs-card-tags"><em className="is-category">{categories[job.category as keyof typeof categories] || job.category}</em><em>{employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</em><em>{job.location}</em></span>
    <p className="managed-job-deadline">Deadline: {formatDeadline(job.deadline)} <span>Nairobi time</span></p>
    {passed && <p className="employer-inline-warning">Deadline passed. New applications are unavailable.</p>}
    <footer className="djobs-card-foot managed-job-foot">{onApplicants ? <ApplicantsButton job={job} onOpen={() => onApplicants(job)} /> : <Link href={"/employer/applications?jobId=" + job.id}>{job._count.applications} confirmed {job._count.applications === 1 ? "application" : "applications"}</Link>}{open(job.id, "djobs-card-cta managed-job-cta", <>{admin ? "Review / manage" : "Manage posting"} &rarr;</>)}</footer>
   </div>
  </article></li>; })}</ul>;
}
export function JobList({ admin = false, imagesEnabled = false }: { admin?: boolean; imagesEnabled?: boolean }) {
 const [status, setStatus] = useState(""), [page, setPage] = useState(1);
 const [data, setData] = useState<{ jobs: Row[]; pagination: { total: number; pageCount: number } } | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [managing, setManaging] = useState<string | null>(null), [reviewing, setReviewing] = useState<{ id: string; title: string } | null>(null);
 const load = useCallback(async (signal?: AbortSignal) => {
  setLoading(true); setError("");
  try { const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) }); const response = await fetch("/api/"+(admin?"admin":"employer")+"/jobs?"+query, { cache: "no-store", signal }); const json = await response.json(); if (!response.ok) throw new Error(json.message || "Unable to load jobs"); setData(json); }
  catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Unable to load jobs"); } finally { if (!signal?.aborted) setLoading(false); }
 }, [page, status, admin]);
 useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
 return <div className="employer-job-list"><div className="employer-toolbar"><label htmlFor="employer-job-status">Posting status<select id="employer-job-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{admin && <FeeSettings />}<CreateJobButton admin={admin} onCreated={(message, openId) => { setNotice(message); setStatus(""); setPage(1); void load(); if (openId) setManaging(openId); }} /></div>
 {notice && <div role="status" className="employer-feedback is-success">{notice}<button className="employer-text-button" onClick={() => setNotice("")}>Dismiss</button></div>}
 {error && <div role="alert" className="employer-feedback is-error">{error}<button className="employer-text-button" onClick={() => void load()}>Try again</button></div>}
 {loading ? <div className="employer-loading" role="status"><span aria-hidden="true"/>Loading job postings...</div> : !error && data && <><div className="employer-results-heading"><h2>{data.pagination.total} {data.pagination.total===1?"posting":"postings"}</h2><span>{status ? "Recently updated first" : "Needs review first, then live, then the rest"}</span></div><ManagedJobCards jobs={data.jobs} admin={admin} onManage={setManaging} onApplicants={job => setReviewing({ id: job.id, title: job.title })}/>{!data.jobs.length && <div className="employer-empty"><h2>No postings in this view</h2><p>{page>1?"Return to the first page to find your postings.":"Choose another status or create a new opportunity for your team."}</p>{(status || page>1) && <button className="employer-secondary" onClick={()=>{setStatus("");setPage(1);}}>Show all postings</button>}</div>}<nav className="employer-pagination" aria-label="Job posting pages"><span>Page {page} of {Math.max(1,data.pagination.pageCount)}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>&larr; Previous</button><button disabled={page>=data.pagination.pageCount} onClick={()=>setPage(page+1)}>Next &#8594;</button></div></nav></>}
 {reviewing && <JobApplicantsModal job={reviewing} onClose={() => { setReviewing(null); void load(); }} />}
 {managing && <JobManageModal id={managing} admin={admin} imagesEnabled={imagesEnabled} onClose={() => { setManaging(null); void load(); }} />}
 </div>;
}

// Who applied, at a glance: the newest applicants' photos, the count and how many are new.
function ApplicantsButton({ job, onOpen }: { job: Row; onOpen: () => void }) {
 const count = job._count.applications, fresh = job.newApplicants ?? 0, faces = job.recentApplicants ?? [];
 if (!count) return <span className="job-card-applicants is-empty">No applicants yet</span>;
 return <button type="button" className="job-card-applicants" onClick={onOpen} aria-label={`Review ${count} ${count === 1 ? "applicant" : "applicants"}${fresh ? `, ${fresh} new` : ""}`}>
  <span className="job-card-faces" aria-hidden="true">{faces.map(person => { const src = avatarSrc(person.id, person.avatarVersion, 28); return <span key={person.id}>{src ? <img src={src} alt="" /> : initialsOf(person.name || "?")}</span>; })}</span>
  <span className="job-card-applicants-text"><strong>{count} {count === 1 ? "applicant" : "applicants"}</strong>{fresh > 0 && <em>{fresh} new</em>}</span>
 </button>;
}
