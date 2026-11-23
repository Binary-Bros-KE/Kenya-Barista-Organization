"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatDeadline } from "@/lib/job-format";
import { avatarSrc } from "@/lib/images";
import { ProfileCard, initialsOf } from "./profile-card";
import { CvViewButton } from "./cv-viewer";
import { RecruitmentActions } from "./recruitment-actions";

// Everyone who applied to one job, in a two-pane popup: the list on the left, the selected applicant on the right
// (profile, contact details, cover letter, CV, message history and the respond form). On phones the panes stack.
type Status = keyof typeof applicationStatusLabels;
type Item = { id: string; status: Status; submittedAt: string | null; version: number; applicantName: string; applicant: { id: string; avatarVersion: number | null; headline: string | null } };
type Detail = {
  id: string; userId: string; status: Status; version: number; submittedAt: string | null;
  job: { title: string; recruiter: { status: string } };
  profile: { fullName: string; email: string; phone: string; location: string; summary: string; coverLetter: string };
  cv: { available: boolean; screening?: boolean; filename: string };
  candidate: { avatarVersion: number | null; headline?: string | null; experienceYears?: number | null; skills?: string[]; openToWork?: boolean; instagram?: string | null; linkedin?: string | null; website?: string | null; accent?: string };
};
type Response = { id: string; senderLabel: string; body: string; status: Status; createdAt: string };

const filters: [string, string][] = [["", "All"], ["SUBMITTED", "New"], ["UNDER_REVIEW", "In review"], ["SHORTLISTED", "Shortlisted"], ["HIRED", "Hired"], ["REJECTED", "Not selected"]];
const ago = (value: string | null) => {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : formatDeadline(value).split(",")[0];
};
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "This couldn't be loaded. Please try again.");
  return data as T;
}

function Face({ id, version, name, size = 40 }: { id: string; version: number | null; name: string; size?: number }) {
  const src = avatarSrc(id, version, size);
  return <span className="applicant-face" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{src ? <img src={src} alt="" /> : initialsOf(name)}</span>;
}

export function JobApplicantsModal({ job, onClose }: { job: { id: string; title: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1), [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { dialog.current?.showModal(); }, []);
  const loadList = useCallback(async (nextPage = 1, keep = false) => {
    setError("");
    try {
      const query = new URLSearchParams({ jobId: job.id, page: String(nextPage), ...(filter ? { status: filter } : {}) });
      const data = await getJson<{ applications: Item[]; pagination: { total: number; pageCount: number } }>(`/api/employer/applications?${query}`);
      setItems(current => keep && current ? [...current, ...data.applications] : data.applications);
      setTotal(data.pagination.total); setPage(nextPage); setPageCount(data.pagination.pageCount);
      if (!keep) setSelected(current => current ?? (window.matchMedia("(min-width: 900px)").matches ? data.applications[0]?.id ?? null : null));
    } catch (problem) { setError((problem as Error).message); }
  }, [job.id, filter]);
  useEffect(() => { setItems(null); void loadList(1); }, [loadList]);

  return <dialog ref={dialog} className="job-create applicants-modal" aria-labelledby="applicants-title" onClose={onClose}>
    <div className="job-create-panel">
      <header className="job-create-head"><div><h2 id="applicants-title">Applicants</h2><p>{job.title}</p></div><button type="button" className="job-create-close" aria-label="Close" onClick={() => dialog.current?.close()}>&times;</button></header>
      <div className={`applicants-body${selected ? " has-selection" : ""}`}>
        <section className="applicants-list" aria-label="Applicants">
          <div className="applicants-filters" role="group" aria-label="Filter by status">{filters.map(([value, label]) => <button type="button" key={value || "all"} aria-pressed={filter === value} className={filter === value ? "is-on" : ""} onClick={() => { setFilter(value); setSelected(null); }}>{label}</button>)}</div>
          <p className="applicants-count" aria-live="polite">{items ? `${total} ${total === 1 ? "applicant" : "applicants"}` : "Loading…"}</p>
          {error && <p className="notice error" role="alert">{error}</p>}
          {items && !items.length && <div className="applicants-empty"><strong>{filter ? "No one here yet" : "No applicants yet"}</strong><span>{filter ? "Try another filter." : "People who apply and pay the fee will appear here."}</span></div>}
          <ul>{items?.map(item => <li key={item.id}><button type="button" className={`applicant-row${selected === item.id ? " is-on" : ""}`} aria-current={selected === item.id} onClick={() => setSelected(item.id)}>
            <Face id={item.applicant.id} version={item.applicant.avatarVersion} name={item.applicantName} />
            <span className="applicant-row-text"><strong>{item.applicantName}</strong><span>{item.applicant.headline || `Applied ${ago(item.submittedAt)}`}</span></span>
            <span className="applicant-row-side"><em className={`applicant-status is-${item.status.toLowerCase()}`}>{item.status === "SUBMITTED" ? "New" : applicationStatusLabels[item.status]}</em>{item.applicant.headline && <small>{ago(item.submittedAt)}</small>}</span>
          </button></li>)}</ul>
          {page < pageCount && <button type="button" className="employer-secondary applicants-more" onClick={() => void loadList(page + 1, true)}>Show more</button>}
        </section>
        <section className="applicants-detail" aria-live="polite">
          {selected ? <ApplicantDetail key={selected} id={selected} onBack={() => setSelected(null)} onChanged={() => void loadList(1)} />
            : <div className="applicants-empty is-detail"><strong>Choose an applicant</strong><span>Their profile, cover letter and CV appear here.</span></div>}
        </section>
      </div>
    </div>
  </dialog>;
}

function ApplicantDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [data, history] = await Promise.all([getJson<Detail>(`/api/employer/applications/${id}`), getJson<{ responses: Response[] }>(`/api/employer/applications/${id}/responses`)]);
      setDetail(data); setResponses(history.responses); setError("");
    } catch (problem) { setError((problem as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="applicants-detail-inner"><button type="button" className="applicants-back" onClick={onBack}>&larr; All applicants</button><p className="notice error" role="alert">{error}</p></div>;
  if (!detail) return <div className="applicants-detail-inner"><div className="applicants-loading" role="status">Loading applicant…</div></div>;
  const { profile, candidate } = detail;
  const cvUrl = `/api/employer/applications/${id}/cv`;
  return <div className="applicants-detail-inner">
    <button type="button" className="applicants-back" onClick={onBack}>&larr; All applicants</button>
    <ProfileCard compact data={{ name: profile.fullName, headline: candidate.headline ?? null, location: profile.location, experienceYears: candidate.experienceYears ?? null, skills: candidate.skills ?? [], openToWork: candidate.openToWork ?? false, accent: candidate.accent ?? "espresso", photo: avatarSrc(detail.userId, candidate.avatarVersion, 84), instagram: candidate.instagram ?? null, linkedin: candidate.linkedin ?? null, website: candidate.website ?? null }} />
    <div className="applicants-meta">
      <span className={`applicant-status is-${detail.status.toLowerCase()}`}>{detail.status === "SUBMITTED" ? "New" : applicationStatusLabels[detail.status]}</span>
      <span>Applied {detail.submittedAt ? formatDeadline(detail.submittedAt) : ""}</span>
    </div>
    <dl className="applicants-contact">
      <div><dt>Email</dt><dd><a href={`mailto:${profile.email}`}>{profile.email}</a></dd></div>
      <div><dt>Phone</dt><dd><a href={`tel:${profile.phone}`}>{profile.phone}</a></dd></div>
      <div><dt>Location</dt><dd>{profile.location}</dd></div>
    </dl>
    <section className="applicants-cv">
      <div><strong>CV</strong><span>{detail.cv.filename}</span></div>
      {detail.cv.available ? <div className="applicants-cv-actions"><CvViewButton src={cvUrl} downloadHref={cvUrl} filename={detail.cv.filename} /><a className="employer-secondary" href={cvUrl}>Download</a></div> : <span className="applicants-muted">{detail.cv.screening ? "Security check in progress. Available shortly." : "Unavailable"}</span>}
    </section>
    <section className="applicants-text"><h3>Cover letter</h3><p>{profile.coverLetter || "No cover letter."}</p></section>
    {profile.summary && <section className="applicants-text"><h3>About them</h3><p>{profile.summary}</p></section>}
    <section className="applicants-text"><h3>Messages and updates</h3>
      {responses.length ? <ol className="applicants-timeline">{responses.map(response => <li key={response.id}><header><strong>{response.senderLabel}</strong><span className={`applicant-status is-${response.status.toLowerCase()}`}>{applicationStatusLabels[response.status]}</span><time>{formatDeadline(response.createdAt)}</time></header><p>{response.body}</p></li>)}</ol>
        : <p className="applicants-muted">No messages yet. Your reply below is shown to the applicant.</p>}
    </section>
    <RecruitmentActions key={detail.version} id={detail.id} version={detail.version} status={detail.status} paused={detail.job.recruiter.status !== "ACTIVE"} onSaved={() => { void load(); onChanged(); }} />
  </div>;
}
