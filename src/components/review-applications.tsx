import Link from "next/link";
import type { CSSProperties } from "react";
import { ApplicantLink } from "./applicant-popup";
import { accents, avatarSrc, type Accent } from "@/lib/images";
import { formatDeadline } from "@/lib/job-format";
import type { listReviewApplications } from "@/server/recruitment";

// The recruiter's Applications tab: coloured status chips, a compact search and a grid of horizontal
// applicant cards tinted with each applicant's own profile colour. Each card opens the applicants popup.
type Result = Awaited<ReturnType<typeof listReviewApplications>>;
type Query = { q?: string; status?: string; jobId?: string };
const chips: [string, string][] = [["", "All"], ["SUBMITTED", "New"], ["UNDER_REVIEW", "In review"], ["SHORTLISTED", "Shortlisted"], ["HIRED", "Hired"], ["REJECTED", "Not selected"], ["WITHDRAWN", "Withdrawn"]];
const label = (status: string) => chips.find(([value]) => value === status)?.[1] ?? status;

function href(query: Query, changes: Query & { page?: number }) {
  const params = new URLSearchParams(Object.entries({ ...query, ...changes }).filter(([, value]) => value !== undefined && value !== "" && value !== 1).map(([key, value]) => [key, String(value)]));
  return "/employer/applications" + (params.size ? "?" + params : "");
}

export function ReviewApplications({ result, query, jobs }: { result: Result; query: Query; jobs: { id: string; title: string }[] }) {
  const all = Object.values(result.counts).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  return <div className="rapp">
    <nav className="rapp-chips" aria-label="Filter by status">{chips.map(([value, text]) => <Link key={value || "all"} href={href(query, { status: value, page: 1 })} aria-current={(query.status || "") === value ? "page" : undefined} className={`rapp-chip is-${(value || "all").toLowerCase()}`}>
      {text}<span>{value ? result.counts[value] ?? 0 : all}</span></Link>)}</nav>
    <form className="rapp-search" aria-label="Search applications">
      {query.status && <input type="hidden" name="status" value={query.status} />}
      <label className="rapp-field is-grow"><span className="sr-only">Job title or applicant email</span><input name="q" maxLength={120} defaultValue={query.q || ""} placeholder="Search by job title or applicant email" /></label>
      <label className="rapp-field"><span className="sr-only">Job posting</span><select name="jobId" defaultValue={query.jobId || ""}><option value="">All your jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
      <button className="rapp-go">Search</button>
      {(query.q || query.jobId || query.status) && <Link className="rapp-reset" href="/employer/applications">Reset</Link>}
    </form>
    <p className="rapp-total">{result.pagination.total} {result.pagination.total === 1 ? "application" : "applications"}{query.status ? ` · ${label(query.status)}` : ""}</p>
    {result.applications.length ? <ul className="rapp-grid">{result.applications.map(app => {
      const theme = accents[(app.applicant.accent in accents ? app.applicant.accent : "espresso") as Accent];
      const photo = avatarSrc(app.applicant.id, app.applicant.avatarVersion, 72), initials = app.applicantName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      const skills = app.applicant.skills.slice(0, 3), more = app.applicant.skills.length - skills.length;
      return <li key={app.id}><ApplicantLink className="rapp-card" application={{ id: app.id, job: { id: app.job.id, title: app.job.title } }}>
        <span className="rapp-band" style={{ "--from": theme.from, "--to": theme.to } as CSSProperties}>
          <span className="rapp-face">{photo ? <img src={photo} alt="" loading="lazy" /> : initials}</span>
          <em className={`rapp-status is-${app.status.toLowerCase()}`}>{label(app.status)}</em>
        </span>
        <span className="rapp-body" style={{ "--tone": theme.from } as CSSProperties}>
          <strong className="rapp-name">{app.applicantName}</strong>
          {app.applicant.headline && <span className="rapp-headline">{app.applicant.headline}</span>}
          <span className="rapp-job"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>{app.job.title}</span>
          <span className="rapp-meta">{[app.location, app.applicant.experienceYears != null ? `${app.applicant.experienceYears} ${app.applicant.experienceYears === 1 ? "year" : "years"} in coffee` : null, app.submittedAt ? `Applied ${formatDeadline(app.submittedAt)}` : null].filter(Boolean).join(" · ")}</span>
          {skills.length > 0 && <span className="rapp-skills">{skills.map(skill => <span key={skill}>{skill}</span>)}{more > 0 && <span className="is-more">+{more}</span>}</span>}
          <span className="rapp-open">Review application <span aria-hidden="true">&rarr;</span></span>
        </span>
      </ApplicantLink></li>;
    })}</ul> : <div className="rapp-empty"><strong>{query.q || query.jobId || query.status ? "No applications match" : "No applications yet"}</strong><span>{query.q || query.jobId || query.status ? "Try another status, job or search." : "When someone applies to one of your jobs and pays the fee, they appear here."}</span>{(query.q || query.jobId || query.status) && <Link className="rapp-go" href="/employer/applications">Clear filters</Link>}</div>}
    {result.pagination.pageCount > 1 && <nav className="rapp-pages" aria-label="Application pages"><span>Page {result.pagination.page} of {result.pagination.pageCount}</span><div>
      {result.pagination.page > 1 && <Link href={href(query, { page: result.pagination.page - 1 })}>&larr; Previous</Link>}
      {result.pagination.page < result.pagination.pageCount && <Link href={href(query, { page: result.pagination.page + 1 })}>Next &rarr;</Link>}</div></nav>}
  </div>;
}
