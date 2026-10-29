"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { statusLabels, formatDeadline, formatFee } from "@/lib/job-format";

type Row = { id: string; title: string; status: keyof typeof statusLabels; deadline: string; applicationFeeMinor: number; organisation: { name: string }; _count: { applications: number } };
export function JobList({ admin = false, organisationId }: { admin?: boolean; organisationId?: string }) {
  const [status, setStatus] = useState(admin ? "PENDING_REVIEW" : "");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ jobs: Row[]; pagination: { total: number; pageCount: number } } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(organisationId ? { organisationId } : {}) });
      const response = await fetch(`/api/${admin ? "admin" : "employer"}/jobs?${query}`, { cache: "no-store", signal });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Unable to load jobs");
      setData(json);
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : "Unable to load jobs"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, status, organisationId, admin]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  return <div className="form-stack"><div className="flex flex-wrap items-end justify-between gap-5"><label className="max-w-xs text-sm">Posting status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Link className="button" href={`/employer/jobs/new${organisationId ? `?organisationId=${encodeURIComponent(organisationId)}` : ""}`}>Create job posting</Link></div>
    {error && <p role="alert" className="notice error">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading jobs…</p> : !error && data && <><p className="hint">{data.pagination.total} posting{data.pagination.total === 1 ? "" : "s"}</p><div className="card overflow-x-auto"><table><thead><tr><th>Job</th><th>Organisation</th><th>Status</th><th>Deadline (Nairobi)</th><th>Application fee</th><th>Action</th></tr></thead><tbody>{data.jobs.map(job => <tr key={job.id}><td className="min-w-40 font-medium">{job.title}</td><td>{job.organisation.name}</td><td>{statusLabels[job.status]}{job.status === "PUBLISHED" && new Date(job.deadline) <= new Date() && <span className="block text-xs text-amber-800">Deadline passed</span>}</td><td>{formatDeadline(job.deadline)}</td><td>{formatFee(job.applicationFeeMinor)}</td><td><Link className="underline" href={`/${admin ? "admin" : "employer"}/jobs/${job.id}`}>{admin ? "Review / manage" : "Manage"}</Link><Link className="block mt-2 underline" href={`/employer/applications?jobId=${job.id}`}>{job._count.applications} applicant(s)</Link></td></tr>)}</tbody></table>{!data.jobs.length && <p className="py-6 text-stone-600">No postings match this view.</p>}</div><nav aria-label="Job posting pages" className="flex items-center gap-4"><button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm">Page {page} of {Math.max(1, data.pagination.pageCount)}</span><button className="button secondary" disabled={page >= data.pagination.pageCount} onClick={() => setPage(page + 1)}>Next</button></nav></>}
  </div>;
}
