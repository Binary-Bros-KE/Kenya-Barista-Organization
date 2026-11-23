"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobCover } from "./job-cover";
import { EmployerLogo } from "./job-card";
import { VerifiedBadge, VerifiedRibbon } from "./verified-badge";
import { applicationStatusLabels } from "@/lib/application-format";
import { categories, employmentTypes, formatDeadline, formatFee } from "@/lib/job-format";
import type { getPublicJob, listPublicJobs } from "@/server/public-jobs";

// "Find jobs" inside the workspace: search open jobs, read one in a popup and start an application without
// leaving the dashboard. The draft opens on the usual application page, where the member finishes and pays.
type Data = Awaited<ReturnType<typeof listPublicJobs>>;
type ListJob = Data["jobs"][number];
type FullJob = Awaited<ReturnType<typeof getPublicJob>>;
type Status = keyof typeof applicationStatusLabels;
type Applied = Record<string, { id: string; status: Status }>;
type Query = { q?: string; location?: string; category?: string; employmentType?: string; page: number };

const daysLeft = (deadline: string | Date) => Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
const closing = (deadline: string | Date) => { const days = daysLeft(deadline); return days <= 1 ? "Closes today" : days <= 7 ? `${days} days left` : null; };

export function DashboardJobs({ query, data, applied, invalid }: { query: Query; data: Data | null; applied: Applied; invalid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<ListJob | null>(null);
  const href = (changes: Partial<Query>) => {
    const next = { ...query, ...changes }, params = new URLSearchParams();
    for (const key of ["q", "location", "category", "employmentType"] as const) if (next[key]) params.set(key, next[key]!);
    if (next.page > 1) params.set("page", String(next.page));
    return "/dashboard/jobs" + (params.size ? "?" + params : "");
  };
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), text = (name: string) => String(form.get(name) || "").trim() || undefined;
    router.push(href({ q: text("q"), location: text("location"), category: text("category"), employmentType: text("employmentType"), page: 1 }));
  }
  const filtered = !!(query.q || query.location || query.category || query.employmentType);

  return <div className="djobs">
    <form className="djobs-search" role="search" onSubmit={search} key={href({})}>
      <label className="djobs-search-main"><span className="sr-only">Search jobs</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input name="q" defaultValue={query.q} placeholder="Job title, skill or café" maxLength={120} /></label>
      <label><span className="sr-only">Location</span><input name="location" defaultValue={query.location} placeholder="Location" maxLength={120} /></label>
      <label><span className="sr-only">Category</span><select name="category" defaultValue={query.category ?? ""}><option value="">All categories</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span className="sr-only">Job type</span><select name="employmentType" defaultValue={query.employmentType ?? ""}><option value="">Any job type</option>{Object.entries(employmentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="djobs-search-button">Search</button>
    </form>
    <nav className="djobs-chips" aria-label="Quick categories">
      <Link href={href({ category: undefined, page: 1 })} className={!query.category ? "is-on" : ""}>All jobs</Link>
      {Object.entries(categories).map(([value, label]) => <Link key={value} href={href({ category: value, page: 1 })} className={`is-${value.toLowerCase()}${query.category === value ? " is-on" : ""}`}>{label}</Link>)}
    </nav>

    {invalid ? <div className="djobs-empty"><strong>Let's refine that search.</strong><span>Some filters weren't valid.</span><Link href="/dashboard/jobs" className="djobs-ghost">Clear search</Link></div>
      : !data ? <div className="djobs-empty" role="alert"><strong>Jobs are unavailable right now.</strong><span>Please try again shortly.</span></div>
      : <>
        <div className="djobs-count"><p aria-live="polite"><strong>{data.pagination.total}</strong> open {data.pagination.total === 1 ? "job" : "jobs"}{filtered ? " match your search" : ""}</p>{filtered && <Link href="/dashboard/jobs">Clear filters</Link>}</div>
        {!data.jobs.length ? <div className="djobs-empty"><strong>{filtered ? "No jobs match that search" : "No open jobs right now"}</strong><span>{filtered ? "Try fewer filters or another word." : "New coffee jobs are added often. Check back soon."}</span></div>
          : <ul className="djobs-grid">{data.jobs.map(job => { const mine = applied[job.id], soon = closing(job.deadline);
            return <li key={job.id}><button type="button" className={`djobs-card is-${job.category.toLowerCase()}`} onClick={() => setOpen(job)}>
              {job.employer.verified && <VerifiedRibbon />}
              <span className="djobs-card-media"><JobCover id={job.id} coverVersion={job.coverVersion} category={job.category} />
              <span className="djobs-card-fee">{formatFee(job.applicationFeeMinor)}</span>
              {mine ? <span className={`djobs-card-mine is-${mine.status.toLowerCase()}`}>{mine.status === "DRAFT" ? "Draft saved" : applicationStatusLabels[mine.status]}</span> : soon && <span className="djobs-card-soon">{soon}</span>}</span>
              <span className="djobs-card-body">
                <span className="djobs-card-employer"><EmployerLogo employer={job.employer} />{job.employer.name}{job.employer.verified && <VerifiedBadge />}</span>
                <strong>{job.title}</strong>
                <span className="djobs-card-tags"><em className="is-category">{categories[job.category as keyof typeof categories] || job.category}</em><em>{employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</em><em>{job.location}</em></span>
                <span className="djobs-card-summary">{job.summary}{job.summary.length === 200 ? "…" : ""}</span>
                <span className="djobs-card-foot"><span>Closes {formatDeadline(job.deadline).split(",")[0]}</span><span className="djobs-card-cta">{mine ? "View" : "View & apply"} <span aria-hidden="true">&rarr;</span></span></span>
              </span>
            </button></li>; })}</ul>}
        {data.pagination.pageCount > 1 && <nav className="djobs-pages" aria-label="Job pages"><span>Page {query.page} of {data.pagination.pageCount}</span><div>{query.page > 1 && <Link href={href({ page: query.page - 1 })}>&larr; Previous</Link>}{query.page < data.pagination.pageCount && <Link href={href({ page: query.page + 1 })}>Next &rarr;</Link>}</div></nav>}
      </>}
    {open && <JobPopup job={open} mine={applied[open.id]} onClose={() => setOpen(null)} />}
  </div>;
}

function JobPopup({ job, mine, onClose }: { job: ListJob; mine?: { id: string; status: Status }; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [full, setFull] = useState<FullJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    fetch(`/api/jobs/${encodeURIComponent(job.slug)}`, { cache: "no-store" }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "This job couldn't be loaded.");
      setFull(data);
    }).catch(problem => setError(problem.message));
  }, [job.slug]);

  async function apply() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: job.slug }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your application couldn't be started.");
      router.push("/dashboard/applications/" + data.id);
    } catch (problem) { setError((problem as Error).message); setBusy(false); }
  }

  const isOpen = full ? full.isOpen : true;
  return <dialog ref={dialog} className={`job-create djobs-popup is-${job.category.toLowerCase()}`} aria-labelledby="djobs-popup-title" onClose={onClose}>
    <div className="job-create-panel">
      <div className="djobs-popup-cover"><JobCover id={job.id} coverVersion={job.coverVersion} category={job.category} size="hero" /><button type="button" className="job-create-close" aria-label="Close" onClick={() => dialog.current?.close()}>&times;</button></div>
      <div className="job-create-body djobs-popup-body">
        <header>
          <span className="djobs-card-employer"><EmployerLogo employer={job.employer} />{job.employer.name}{job.employer.verified && <VerifiedBadge />}</span>
          <h2 id="djobs-popup-title">{job.title}</h2>
          <span className="djobs-card-tags"><em className="is-category">{categories[job.category as keyof typeof categories] || job.category}</em><em>{employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</em><em>{job.location}</em></span>
        </header>
        <dl className="djobs-facts">
          <div className="is-fee"><dt>Application fee</dt><dd>{formatFee(job.applicationFeeMinor)}</dd></div>
          <div className="is-deadline"><dt>Deadline (Nairobi)</dt><dd>{formatDeadline(job.deadline)}</dd></div>
          <div className="is-type"><dt>Job type</dt><dd>{employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType}</dd></div>
        </dl>
        <section className="djobs-description"><h3>About this job</h3>{full ? <p>{full.description}</p> : error ? null : <p className="djobs-muted">Loading the full description…</p>}</section>
        {error && <p className="notice error" role="alert">{error}</p>}
        <p className="djobs-note">You'll add a cover letter and your CV next, then pay the fee with M-Pesa to send it. Payment does not guarantee employment.</p>
      </div>
      <footer className="job-create-foot djobs-popup-foot">
        <button type="button" className="employer-text-button" onClick={() => dialog.current?.close()}>Close</button>
        {mine ? <Link className="djobs-apply" href={"/dashboard/applications/" + mine.id}>{mine.status === "DRAFT" ? "Continue your application" : "View your application"} <span aria-hidden="true">&rarr;</span></Link>
          : isOpen ? <button type="button" className="djobs-apply" disabled={busy} onClick={() => void apply()}>{busy ? "Starting…" : "Apply now"} <span aria-hidden="true">&rarr;</span></button>
          : <span className="djobs-muted">Applications are closed</span>}
      </footer>
    </div>
  </dialog>;
}
