"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreateJobButton } from "./job-create-modal";
import { JobManageModal } from "./job-manage-modal";
import { statusLabels, formatDeadline, formatFee } from "@/lib/job-format";
type Row = { id: string; title: string; status: keyof typeof statusLabels; deadline: string; applicationFeeMinor: number; recruiter: { name: string | null }; _count: { applications: number } };
// With onManage, the title and "Manage posting" open the manage popup; without it they link to the job page.
export function ManagedJobCards({ jobs, admin = false, onManage }: { jobs: Row[]; admin?: boolean; onManage?: (id: string) => void }) {
 const href = (id: string) => "/" + (admin ? "admin" : "employer") + "/jobs/" + id;
 const open = (id: string, className: string | undefined, children: React.ReactNode) => onManage ? <button type="button" className={className ? className + " is-button" : "employer-job-title-button"} onClick={() => onManage(id)}>{children}</button> : <Link className={className} href={href(id)}>{children}</Link>;
 return <div className="employer-job-grid">{jobs.map(job => <article className="employer-job-card" key={job.id}><header><span className={"employer-status status-"+job.status.toLowerCase()}>{statusLabels[job.status]}</span><span className="employer-job-fee">{formatFee(job.applicationFeeMinor)} <span>application fee</span></span></header>{admin && <p className="employer-job-org">{job.recruiter.name}</p>}<h3>{open(job.id, undefined, job.title)}</h3><p className="employer-job-deadline">Deadline: {formatDeadline(job.deadline)} <span>Nairobi time</span></p>{job.status === "PUBLISHED" && new Date(job.deadline) <= new Date() && <p className="employer-inline-warning">Deadline passed. New applications are unavailable.</p>}<footer><Link href={"/employer/applications?jobId="+job.id}>{job._count.applications} confirmed {job._count.applications === 1 ? "application" : "applications"}</Link>{open(job.id, "employer-card-action", <>{admin ? "Review / manage" : "Manage posting"} &#8599;</>)}</footer></article>)}</div>;
}
export function JobList({ admin = false, imagesEnabled = false }: { admin?: boolean; imagesEnabled?: boolean }) {
 const [status, setStatus] = useState(admin ? "PENDING_REVIEW" : ""), [page, setPage] = useState(1);
 const [data, setData] = useState<{ jobs: Row[]; pagination: { total: number; pageCount: number } } | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [managing, setManaging] = useState<string | null>(null);
 const load = useCallback(async (signal?: AbortSignal) => {
  setLoading(true); setError("");
  try { const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) }); const response = await fetch("/api/"+(admin?"admin":"employer")+"/jobs?"+query, { cache: "no-store", signal }); const json = await response.json(); if (!response.ok) throw new Error(json.message || "Unable to load jobs"); setData(json); }
  catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Unable to load jobs"); } finally { if (!signal?.aborted) setLoading(false); }
 }, [page, status, admin]);
 useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
 return <div className="employer-job-list"><div className="employer-toolbar"><label htmlFor="employer-job-status">Posting status<select id="employer-job-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><CreateJobButton admin={admin} onCreated={(message, openId) => { setNotice(message); setStatus(""); setPage(1); void load(); if (openId) setManaging(openId); }} /></div>
 {notice && <div role="status" className="employer-feedback is-success">{notice}<button className="employer-text-button" onClick={() => setNotice("")}>Dismiss</button></div>}
 {error && <div role="alert" className="employer-feedback is-error">{error}<button className="employer-text-button" onClick={() => void load()}>Try again</button></div>}
 {loading ? <div className="employer-loading" role="status"><span aria-hidden="true"/>Loading job postings...</div> : !error && data && <><div className="employer-results-heading"><h2>{data.pagination.total} {data.pagination.total===1?"posting":"postings"}</h2><span>Recently updated first</span></div><ManagedJobCards jobs={data.jobs} admin={admin} onManage={setManaging}/>{!data.jobs.length && <div className="employer-empty"><h2>No postings in this view</h2><p>{page>1?"Return to the first page to find your postings.":"Choose another status or create a new opportunity for your team."}</p>{(status || page>1) && <button className="employer-secondary" onClick={()=>{setStatus("");setPage(1);}}>Show all postings</button>}</div>}<nav className="employer-pagination" aria-label="Job posting pages"><span>Page {page} of {Math.max(1,data.pagination.pageCount)}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>&larr; Previous</button><button disabled={page>=data.pagination.pageCount} onClick={()=>setPage(page+1)}>Next &#8594;</button></div></nav></>}
 {managing && <JobManageModal id={managing} admin={admin} imagesEnabled={imagesEnabled} onClose={() => { setManaging(null); void load(); }} />}
 </div>;
}
