"use client";
// The job editor (manage popup and job pages): edits on the left; on the right a live preview of the card applicants
// see and the recruiter at a glance, like Profile & CV. Decisions sit in a bar pinned to the bottom.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobCoverEditor } from "./job-cover-editor";
import { JobCover } from "./job-cover";
import { EmployerLogo } from "./job-card";
import { VerifiedBadge, VerifiedRibbon } from "./verified-badge";
import { initialsOf } from "./profile-card";
import { avatarSrc } from "@/lib/images";
import { categories, employmentTypes, statusLabels, formatDeadline, formatFee, nairobiInput, nairobiToIso } from "@/lib/job-format";
type Job = { id: string; title: string; description: string; location: string; category: string; employmentType: string; deadline: string; slug: string; applicationFeeMinor: number; version: number; status: keyof typeof statusLabels; reviewNote: string | null; recruiterId: string; coverVersion: number | null; recruiter: { id: string; name: string | null; email: string; status: string; avatarVersion: number | null; recruiterVerifiedAt: string | null }; history: { id: string; fromStatus: keyof typeof statusLabels | null; toStatus: keyof typeof statusLabels; note: string | null; createdAt: string }[] };
type Draft = { title: string; description: string; location: string; category: string; employmentType: string; deadline: string; applicationFeeKes: string; recruiterId: string };
const empty: Draft = { title: "", description: "", location: "", category: "BARISTA", employmentType: "FULL_TIME", deadline: "", applicationFeeKes: "", recruiterId: "" };

export function JobEditor({ id, admin, imagesEnabled = false }: { id?: string; admin: boolean; imagesEnabled?: boolean }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null); const [draft, setDraft] = useState<Draft>(empty); const [recruiters, setRecruiters] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [defaultFee, setDefaultFee] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [reviewNote, setReviewNote] = useState(""); const [feeOverride, setFeeOverride] = useState<string | null>(null);
  // A quiet reload keeps the editor on screen (used after a cover change).
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError("");
    try {
      const response = await fetch(id ? `/api/employer/jobs/${id}` : "/api/employer/job-options", { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (id) { setJob(data); setDraft({ title: data.title, description: data.description, location: data.location, category: data.category, employmentType: data.employmentType, deadline: nairobiInput(data.deadline), applicationFeeKes: String(data.applicationFeeMinor / 100), recruiterId: data.recruiterId }); }
      else { setRecruiters(data.recruiters); setDefaultFee(data.defaultApplicationFeeMinor); setDraft({ ...empty, applicationFeeKes: data.defaultApplicationFeeMinor == null ? "" : String(data.defaultApplicationFeeMinor / 100) }); }
      setDirty(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load posting"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  function field(key: keyof Draft, value: string) { setDraft(current => ({ ...current, [key]: value })); setDirty(true); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const input = { title: draft.title, description: draft.description, location: draft.location, category: draft.category, employmentType: draft.employmentType, deadline: nairobiToIso(draft.deadline), applicationFeeKes: Number(draft.applicationFeeKes) };
      const response = await fetch(id ? `/api/employer/jobs/${id}` : "/api/employer/jobs", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { ...input, version: job!.version } : { ...(admin ? { recruiterId: draft.recruiterId } : {}), job: input }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (!id) { router.push(`/${admin ? "admin" : "employer"}/jobs/${data.id}`); }
      else { const wasInReview = job?.status === "PENDING_REVIEW"; await load(); setMessage(wasInReview ? "Changes saved. The job is still awaiting review, and KBO will see your latest version." : "Draft saved. Submit it for review when ready."); }
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save posting"); }
    finally { setBusy(false); }
  }
  async function adjustFee() {
    if (!job || feeOverride === null) return; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/employer/jobs/${job.id}/fee`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: job.version, applicationFeeKes: Number(feeOverride) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await load(true); setFeeOverride(null); setMessage(`Application fee changed to ${formatFee(data.applicationFeeMinor)}.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to change the fee"); }
    finally { setBusy(false); }
  }
  async function transition(action: string) {
    if (!job) return; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/employer/jobs/${job.id}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: job.version, action, ...(action === "request_changes" ? { note: reviewNote } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await load(); setReviewNote(""); setMessage(action === "publish" ? "Job approved and published." : "Posting updated.");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update posting"); }
    finally { setBusy(false); }
  }
  const editable = !job || ["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW", "PUBLISHED"].includes(job.status);
  const tone: Record<string, string> = { submit: "teal", publish: "green", withdraw: "amber", close: "rose", reopen: "teal", archive: "grey", request_changes: "orange" };
  const actionButton = (action: string, label: string, disabled = false) => <button key={action} type="button" className={`jeditor-action is-${tone[action] ?? "grey"}`} disabled={busy || dirty || disabled} onClick={() => void transition(action)}>{label}</button>;
  if (!loading && id && !job) return <p role="alert" className="notice error">{error || "Unable to load this posting."} <button className="underline" onClick={() => void load()}>Retry</button></p>;
  const verified = !!job?.recruiter.recruiterVerifiedAt;
  const reviewing = !!(admin && job?.status === "PENDING_REVIEW");
  const saveDisabled = busy || Boolean(job && job.recruiter.status !== "ACTIVE") || (!id && admin && !draft.recruiterId);
  const step = (number: string, title: string, text: string) => <header><span className="studio-step">{number}</span><div><h2>{title}</h2><p>{text}</p></div></header>;
  const photo = job ? avatarSrc(job.recruiter.id, job.recruiter.avatarVersion, 96) : null;
  return <div className="employer-job-editor jeditor"><div className="jeditor-content">
    {error && <p role="alert" className="notice error jeditor-wide">{error} <button className="underline" onClick={() => void load()}>Reload posting</button></p>}{message && <p role="status" className="notice success jeditor-wide">{message}</p>}
    {loading ? <p role="status" className="jeditor-wide">Loading posting…</p> : <>
    <div className="jeditor-main">
      {job && <section className="studio-panel jeditor-workflow">
        {step("01", "Review and status", reviewing ? "Approve it, send it back with feedback, or adjust the fee. The buttons are at the bottom." : "Where this posting is. The actions are at the bottom.")}
        <div className="jeditor-status-row"><span className={"djobs-card-status status-" + job.status.toLowerCase()}>{statusLabels[job.status]}</span>{["PUBLISHED", "CLOSED"].includes(job.status) && <Link className="jeditor-link" href={`/jobs/${job.slug}`}>View public page &#8599;</Link>}</div>
        {job.reviewNote && <p className="notice error">Review feedback: {job.reviewNote}</p>}
        {job.status === "PENDING_REVIEW" && <p className="jeditor-note is-info">Awaiting review. Edits are still allowed; saving keeps it in review with the latest version.</p>}
        {job.status === "PUBLISHED" && <p className="jeditor-note is-warn">Saving edits takes this posting off the public site and returns it to draft until it&apos;s reviewed again.</p>}
        {job.recruiter.status !== "ACTIVE" && <p className="notice error">This recruiter&apos;s account is suspended. Reactivate it before editing or publishing jobs.</p>}
        {reviewing && <div className="jeditor-admin">
          <div className="jeditor-fee"><label>Application fee (KES)<input type="number" min={1} max={250000} step={1} value={feeOverride ?? String(job.applicationFeeMinor / 100)} onChange={event => setFeeOverride(event.target.value)} /></label><button type="button" className="jeditor-action is-gold" disabled={busy || feeOverride === null || Number(feeOverride) * 100 === job.applicationFeeMinor || !(Number(feeOverride) >= 1)} onClick={() => void adjustFee()}>Adjust fee</button><span>The recruiter set {formatFee(job.applicationFeeMinor)}. Changing it keeps the job in review and is recorded in its history.</span></div>
          <label className="jeditor-feedback">Feedback for the recruiter<textarea maxLength={2000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} placeholder="What should they fix before this can be published? Needed for Return with feedback." /></label>
        </div>}
      </section>}
      {editable && <form id="jeditor-form" onSubmit={save} className="studio-panel jeditor-form">
        {step(job ? "02" : "01", job ? "Role details" : "Create a draft", "What applicants read before they apply.")}
        <span className={"jeditor-save-state" + (dirty ? " is-dirty" : "")}>{dirty ? "Unsaved changes" : job ? "Saved" : "New posting"}</span>
        {!id && admin && <label>Recruiter<select required value={draft.recruiterId} onChange={event => field("recruiterId", event.target.value)}><option value="" disabled>Choose the recruiter this job belongs to</option>{recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.name || recruiter.email}</option>)}</select>{!recruiters.length && <span className="jeditor-hint">No recruiter accounts yet. Make an account a recruiter from Accounts first.</span>}</label>}
        <label>Job title<input required minLength={5} maxLength={160} value={draft.title} onChange={event => field("title", event.target.value)} /></label>
        <div className="jeditor-pair"><label>Location<input required minLength={2} maxLength={120} value={draft.location} onChange={event => field("location", event.target.value)} placeholder="Nairobi" /></label><label>Employment type<select value={draft.employmentType} onChange={event => field("employmentType", event.target.value)}>{Object.entries(employmentTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <div className="jeditor-pair"><label>Category<select value={draft.category} onChange={event => field("category", event.target.value)}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Deadline (Nairobi time)<input type="datetime-local" required value={draft.deadline} onChange={event => field("deadline", event.target.value)} /></label></div>
        <label>Application fee (KES)<input type="number" min={1} max={250000} step={1} required value={draft.applicationFeeKes} onChange={event => field("applicationFeeKes", event.target.value)} /><span className="jeditor-hint">What applicants pay to apply.{admin ? "" : " KBO may adjust it before approving the job."} The fee locks once someone starts an application.</span></label>
        <label>Job description<textarea required minLength={50} maxLength={12000} rows={9} value={draft.description} onChange={event => field("description", event.target.value)} /><span className="jeditor-hint">Responsibilities, requirements and working conditions. Plain text. {draft.description.length.toLocaleString()} / 12,000</span></label>
      </form>}
      {job && <JobCoverEditor job={job} imagesEnabled={imagesEnabled} step={editable ? "03" : "02"} blocked={job.recruiter.status !== "ACTIVE" ? "Reactivate the recruiter first." : dirty ? "Save your text changes first, then change the cover." : ""} onChanged={() => load(true)} />}
      {!job && imagesEnabled && <p className="jeditor-note is-info">Save the draft first, then add a cover photo.</p>}
      {job && <details className="studio-panel jeditor-history"><summary>Posting history <span>{job.history.length}</span></summary><ol>{job.history.map(item => <li key={item.id}><span className={"djobs-card-status status-" + item.toStatus.toLowerCase()}>{statusLabels[item.toStatus]}</span><div><strong>{item.fromStatus ? `From ${statusLabels[item.fromStatus]}` : "Created"}</strong><time>{formatDeadline(item.createdAt)}</time>{item.note && <p>{item.note}</p>}</div></li>)}</ol></details>}
    </div>
    <aside className="jeditor-side">
      {job && <section className="studio-panel jeditor-recruiter">
        <p className="studio-side-label">Recruiter</p>
        <div className="jeditor-recruiter-head"><span className="jeditor-avatar">{photo ? <img src={photo} alt="" /> : initialsOf(job.recruiter.name || job.recruiter.email)}</span><div><strong>{job.recruiter.name || "KBO recruiter"}</strong><a href={`mailto:${job.recruiter.email}`}>{job.recruiter.email}</a></div></div>
        <div className="jeditor-recruiter-tags">{verified ? <span className="jeditor-pill is-green">✓ Verified recruiter</span> : <span className="jeditor-pill is-grey">Not verified</span>}<span className={"jeditor-pill " + (job.recruiter.status === "ACTIVE" ? "is-teal" : "is-rose")}>{job.recruiter.status === "ACTIVE" ? "Active" : "Suspended"}</span></div>
      </section>}
      <p className="studio-side-label">How applicants see it</p>
      <article className={`djobs-card jeditor-preview is-${draft.category.toLowerCase()}`}>
        {verified && <VerifiedRibbon />}
        <span className="djobs-card-media"><JobCover id={job?.id ?? "new"} coverVersion={job?.coverVersion ?? null} category={draft.category} /><span className="djobs-card-fee">{draft.applicationFeeKes ? formatFee(Number(draft.applicationFeeKes) * 100) : "Fee"}</span>{job && <span className={"djobs-card-status status-" + job.status.toLowerCase()}>{statusLabels[job.status]}</span>}</span>
        <span className="djobs-card-body">
          {job && <span className="djobs-card-employer"><EmployerLogo employer={{ id: job.recruiter.id, avatarVersion: job.recruiter.avatarVersion }} />{job.recruiter.name || "KBO recruiter"}{verified && <VerifiedBadge />}</span>}
          <strong>{draft.title || "Job title"}</strong>
          <span className="djobs-card-tags"><em className="is-category">{categories[draft.category as keyof typeof categories] || draft.category}</em><em>{employmentTypes[draft.employmentType as keyof typeof employmentTypes] || draft.employmentType}</em>{draft.location && <em>{draft.location}</em>}</span>
          <span className="djobs-card-summary">{draft.description ? draft.description.slice(0, 160) + (draft.description.length > 160 ? "…" : "") : "The first lines of the description show here."}</span>
          <span className="djobs-card-foot"><span>{draft.deadline ? "Closes " + formatDeadline(nairobiToIso(draft.deadline)).split(",")[0] : "Set a deadline"}</span><span className="djobs-card-cta">View &amp; apply &rarr;</span></span>
        </span>
      </article>
      {dirty && <p className="jeditor-note is-warn">The preview shows your unsaved changes.</p>}
    </aside>
    </>}</div>
    {/* Below the scrolling content in the popup (pinned to the bottom on a page), so the decisions are always in reach. */}
    {!loading && <>
    <div className="jeditor-bar">
      <p className="jeditor-bar-state">{dirty ? <strong>Unsaved changes. Save before taking an action.</strong> : job ? <>Status: <strong>{statusLabels[job.status]}</strong></> : "New posting"}</p>
      <div className="jeditor-bar-actions">
        {job && ["DRAFT", "CHANGES_REQUESTED", "CLOSED"].includes(job.status) && actionButton("archive", "Archive")}
        {job?.status === "CLOSED" && actionButton("reopen", "Reopen as draft")}
        {job?.status === "PUBLISHED" && actionButton("close", "Close applications")}
        {job?.status === "PENDING_REVIEW" && actionButton("withdraw", "Withdraw to draft")}
        {reviewing && actionButton("request_changes", "Return with feedback", !reviewNote.trim())}
        {editable && <button form="jeditor-form" className={"jeditor-action " + (dirty || !job ? "is-brown" : "is-ghost")} disabled={saveDisabled}>{busy ? "Saving…" : job ? "Save changes" : "Save draft"}</button>}
        {job && ["DRAFT", "CHANGES_REQUESTED"].includes(job.status) && actionButton("submit", "Submit for review")}
        {reviewing && actionButton("publish", "✓ Approve and publish")}
      </div>
    </div>
    </>}
  </div>;
}
