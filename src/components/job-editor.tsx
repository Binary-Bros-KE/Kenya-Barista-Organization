"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobCoverEditor } from "./job-cover-editor";
import { categories, employmentTypes, statusLabels, formatDeadline, formatFee, nairobiInput, nairobiToIso } from "@/lib/job-format";
type Job = { id: string; title: string; description: string; location: string; category: string; employmentType: string; deadline: string; slug: string; applicationFeeMinor: number; version: number; status: keyof typeof statusLabels; reviewNote: string | null; recruiterId: string; coverVersion: number | null; recruiter: { name: string | null; email: string; status: string }; history: { id: string; fromStatus: keyof typeof statusLabels | null; toStatus: keyof typeof statusLabels; note: string | null; createdAt: string }[] };
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
      else { await load(); setMessage("Draft saved. Submit it for review when ready."); }
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
  const editable = !job || ["DRAFT", "CHANGES_REQUESTED", "PUBLISHED"].includes(job.status);
  const actionButton = (action: string, label: string, disabled = false) => <button key={action} className="button secondary" disabled={busy || dirty || disabled} onClick={() => void transition(action)}>{label}</button>;
  if (!loading && id && !job) return <p role="alert" className="notice error">{error || "Unable to load this posting."} <button className="underline" onClick={() => void load()}>Retry</button></p>;
  return <div className="employer-job-editor form-stack">
    {error && <p role="alert" className="notice error">{error} <button className="underline" onClick={() => void load()}>Reload posting</button></p>}{message && <p role="status" className="notice success">{message}</p>}
    {loading ? <p role="status">Loading posting…</p> : <>
      {job && <div className="card form-stack employer-job-workflow"><span className="employer-eyebrow">POSTING WORKFLOW</span><div className="flex flex-wrap items-center justify-between gap-4"><p className="font-semibold">{statusLabels[job.status]} · {job.recruiter.name || job.recruiter.email}</p>{["PUBLISHED", "CLOSED"].includes(job.status) && <Link className="underline" href={`/jobs/${job.slug}`}>View public page</Link>}</div>{job.reviewNote && <p className="notice error">Review feedback: {job.reviewNote}</p>}{dirty && <p className="hint">Save your changes before taking a workflow action.</p>}<div className="flex flex-wrap gap-3">
        {["DRAFT", "CHANGES_REQUESTED"].includes(job.status) && actionButton("submit", "Submit for review")}
        {job.status === "PENDING_REVIEW" && <>{actionButton("withdraw", "Withdraw to draft")}{admin && actionButton("publish", "Approve and publish")}</>}
        {job.status === "PUBLISHED" && actionButton("close", "Close applications")}
        {job.status === "CLOSED" && actionButton("reopen", "Reopen as draft")}
        {["DRAFT", "CHANGES_REQUESTED", "CLOSED"].includes(job.status) && actionButton("archive", "Archive posting")}
      </div>{admin && job.status === "PENDING_REVIEW" && <div className="form-stack"><div className="employer-fee-adjust"><label>Application fee in KES<input type="number" min={1} max={250000} step={1} value={feeOverride ?? String(job.applicationFeeMinor / 100)} onChange={event => setFeeOverride(event.target.value)} /></label><button type="button" className="button secondary" disabled={busy || feeOverride === null || Number(feeOverride) * 100 === job.applicationFeeMinor || !(Number(feeOverride) >= 1)} onClick={() => void adjustFee()}>Adjust fee</button><span className="hint">The recruiter set {formatFee(job.applicationFeeMinor)}. Changing it keeps the job in review and is shown in its history.</span></div><label>Changes required<textarea maxLength={2000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} /></label><div>{actionButton("request_changes", "Return with feedback", !reviewNote.trim())}</div></div>}</div>}
      
      {job?.status === "PUBLISHED" && <p className="notice error">Saving edits will remove this posting from public view and return it to draft. It must be reviewed again before publication.</p>}
      {job && job.recruiter.status !== "ACTIVE" && <p className="notice error">This recruiter's account is suspended. Reactivate it before editing or publishing jobs.</p>}
      {job && <JobCoverEditor job={job} imagesEnabled={imagesEnabled} blocked={job.recruiter.status !== "ACTIVE" ? "Reactivate the recruiter first." : dirty ? "Save your text changes first, then change the cover." : ""} onChanged={() => load(true)} />}
      {!job && imagesEnabled && <p className="hint">Save the draft first, then add a cover photo.</p>}
      {editable && <form onSubmit={save} className="card form-stack employer-editor-form"><div className="employer-section-heading"><div><span className="employer-eyebrow">ROLE DETAILS</span><h2>{job ? "Edit your opportunity" : "Create a draft"}</h2></div><span className="employer-save-state">{dirty ? "Unsaved changes" : job ? "Saved" : "New posting"}</span></div>
        {!id && admin && <label>Recruiter<select required value={draft.recruiterId} onChange={event => field("recruiterId", event.target.value)}><option value="" disabled>Choose the recruiter this job belongs to</option>{recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.name || recruiter.email}</option>)}</select>{!recruiters.length && <span className="hint">No recruiter accounts yet. Make an account a recruiter from Accounts first.</span>}</label>}
        <label>Job title<input required minLength={5} maxLength={160} value={draft.title} onChange={event => field("title", event.target.value)} /></label>
        <label>Job description<textarea required minLength={50} maxLength={12000} rows={10} value={draft.description} onChange={event => field("description", event.target.value)} /><span className="hint">Include responsibilities, requirements, and working conditions. Plain text only. {draft.description.length.toLocaleString()} / 12,000 characters.</span></label>
        <div className="grid gap-5 sm:grid-cols-2"><label>Location<input required minLength={2} maxLength={120} value={draft.location} onChange={event => field("location", event.target.value)} placeholder="Nairobi" /></label><label>Employment type<select value={draft.employmentType} onChange={event => field("employmentType", event.target.value)}>{Object.entries(employmentTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <div className="grid gap-5 sm:grid-cols-2"><label>Category<select value={draft.category} onChange={event => field("category", event.target.value)}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Application deadline (Nairobi time)<input type="datetime-local" required value={draft.deadline} onChange={event => field("deadline", event.target.value)} /><span className="hint">All deadlines use Africa/Nairobi time.</span></label></div>
        <label>Application fee in KES<input type="number" min={1} max={250000} step={1} required value={draft.applicationFeeKes} onChange={event => field("applicationFeeKes", event.target.value)} /><span className="hint">What applicants pay to apply.{admin ? "" : " KBO may adjust it before approving the job."} The fee locks once someone starts an application.</span></label>
        <button className="button" disabled={busy || Boolean(job && job.recruiter.status !== "ACTIVE") || (!id && admin && !draft.recruiterId)}>{busy ? "Saving…" : "Save draft"}</button>
      </form>}
      {job && <><section className="card employer-job-preview"><p className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-500">Saved posting preview</p><h2 className="text-2xl">{job.title}</h2><p className="my-4 text-sm text-stone-600">{job.location} · {employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType} · Deadline {formatDeadline(job.deadline)}</p><p className="whitespace-pre-wrap leading-8">{job.description}</p><p className="mt-5 font-semibold">Application fee: {formatFee(job.applicationFeeMinor)}</p></section><details className="card employer-job-history"><summary className="cursor-pointer font-semibold">Posting history</summary><ol className="mt-5 space-y-4">{job.history.map(item => <li key={item.id} className="text-sm"><span className="font-semibold">{item.fromStatus ? `${statusLabels[item.fromStatus]} → ` : ""}{statusLabels[item.toStatus]}</span><span className="ml-3 text-stone-500">{formatDeadline(item.createdAt)}</span>{item.note && <p className="mt-1 whitespace-pre-wrap text-stone-600">{item.note}</p>}</li>)}</ol></details></>}
    </>}
  </div>;
}
