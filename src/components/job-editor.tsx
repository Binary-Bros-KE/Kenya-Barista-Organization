"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categories, employmentTypes, statusLabels, formatDeadline, formatFee, nairobiInput, nairobiToIso } from "@/lib/job-format";
type Job = { id: string; title: string; description: string; location: string; category: string; employmentType: string; deadline: string; slug: string; applicationFeeMinor: number; version: number; status: keyof typeof statusLabels; reviewNote: string | null; organisationId: string; organisation: { name: string; suspendedAt: string | null }; history: { id: string; fromStatus: keyof typeof statusLabels | null; toStatus: keyof typeof statusLabels; note: string | null; createdAt: string }[] };
type Draft = { title: string; description: string; location: string; category: string; employmentType: string; deadline: string; applicationFeeKes: string; organisationId: string };
const empty: Draft = { title: "", description: "", location: "", category: "BARISTA", employmentType: "FULL_TIME", deadline: "", applicationFeeKes: "", organisationId: "" };

export function JobEditor({ id, admin, initialOrganisationId }: { id?: string; admin: boolean; initialOrganisationId?: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null); const [draft, setDraft] = useState<Draft>(empty); const [organisations, setOrganisations] = useState<{ id: string; name: string }[]>([]);
  const [defaultFee, setDefaultFee] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [reviewNote, setReviewNote] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(id ? `/api/employer/jobs/${id}` : "/api/employer/job-options", { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (id) { setJob(data); setDraft({ title: data.title, description: data.description, location: data.location, category: data.category, employmentType: data.employmentType, deadline: nairobiInput(data.deadline), applicationFeeKes: String(data.applicationFeeMinor / 100), organisationId: data.organisationId }); }
      else { setOrganisations(data.organisations); setDefaultFee(data.defaultApplicationFeeMinor); setDraft({ ...empty, organisationId: data.organisations.some((org: { id: string }) => org.id === initialOrganisationId) ? initialOrganisationId! : "", applicationFeeKes: data.defaultApplicationFeeMinor == null ? "" : String(data.defaultApplicationFeeMinor / 100) }); }
      setDirty(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load posting"); }
    finally { setLoading(false); }
  }, [id, initialOrganisationId]);
  useEffect(() => { void load(); }, [load]);
  function field(key: keyof Draft, value: string) { setDraft(current => ({ ...current, [key]: value })); setDirty(true); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const input = { title: draft.title, description: draft.description, location: draft.location, category: draft.category, employmentType: draft.employmentType, deadline: nairobiToIso(draft.deadline), ...(admin ? { applicationFeeKes: Number(draft.applicationFeeKes) } : {}) };
      const response = await fetch(id ? `/api/employer/jobs/${id}` : "/api/employer/jobs", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { ...input, version: job!.version } : { organisationId: draft.organisationId, job: input }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      if (!id) { router.push(`/${admin ? "admin" : "employer"}/jobs/${data.id}`); }
      else { await load(); setMessage("Draft saved. Submit it for review when ready."); }
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save posting"); }
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
      {job && <div className="card form-stack employer-job-workflow"><span className="employer-eyebrow">POSTING WORKFLOW</span><div className="flex flex-wrap items-center justify-between gap-4"><p className="font-semibold">{statusLabels[job.status]} · {job.organisation.name}</p>{["PUBLISHED", "CLOSED"].includes(job.status) && <Link className="underline" href={`/jobs/${job.slug}`}>View public page</Link>}</div>{job.reviewNote && <p className="notice error">Review feedback: {job.reviewNote}</p>}{dirty && <p className="hint">Save your changes before taking a workflow action.</p>}<div className="flex flex-wrap gap-3">
        {["DRAFT", "CHANGES_REQUESTED"].includes(job.status) && actionButton("submit", "Submit for review")}
        {job.status === "PENDING_REVIEW" && <>{actionButton("withdraw", "Withdraw to draft")}{admin && actionButton("publish", "Approve and publish")}</>}
        {job.status === "PUBLISHED" && actionButton("close", "Close applications")}
        {job.status === "CLOSED" && actionButton("reopen", "Reopen as draft")}
        {["DRAFT", "CHANGES_REQUESTED", "CLOSED"].includes(job.status) && actionButton("archive", "Archive posting")}
      </div>{admin && job.status === "PENDING_REVIEW" && <div className="form-stack"><label>Changes required<textarea maxLength={2000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} /></label><div>{actionButton("request_changes", "Return with feedback", !reviewNote.trim())}</div></div>}</div>}
      {!id && !admin && defaultFee == null && <p className="notice error">An administrator must configure the application fee before you can create a posting.</p>}
      {job?.status === "PUBLISHED" && <p className="notice error">Saving edits will remove this posting from public view and return it to draft. It must be reviewed again before publication.</p>}
      {job?.organisation.suspendedAt && <p className="notice error">This organisation is suspended. Reactivate it before editing or publishing jobs.</p>}
      {editable && <form onSubmit={save} className="card form-stack employer-editor-form"><div className="employer-section-heading"><div><span className="employer-eyebrow">ROLE DETAILS</span><h2>{job ? "Edit your opportunity" : "Create a draft"}</h2></div><span className="employer-save-state">{dirty ? "Unsaved changes" : job ? "Saved" : "New posting"}</span></div>
        {!id && <label>Organisation<select required value={draft.organisationId} onChange={event => field("organisationId", event.target.value)}><option value="" disabled>Choose an organisation</option>{organisations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select>{!organisations.length && <span className="hint">An active organisation membership is required. Administrators can create organisations in Administration.</span>}</label>}
        <label>Job title<input required minLength={5} maxLength={160} value={draft.title} onChange={event => field("title", event.target.value)} /></label>
        <label>Job description<textarea required minLength={50} maxLength={12000} rows={10} value={draft.description} onChange={event => field("description", event.target.value)} /><span className="hint">Include responsibilities, requirements, and working conditions. Plain text only. {draft.description.length.toLocaleString()} / 12,000 characters.</span></label>
        <div className="grid gap-5 sm:grid-cols-2"><label>Location<input required minLength={2} maxLength={120} value={draft.location} onChange={event => field("location", event.target.value)} placeholder="Nairobi" /></label><label>Employment type<select value={draft.employmentType} onChange={event => field("employmentType", event.target.value)}>{Object.entries(employmentTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
        <div className="grid gap-5 sm:grid-cols-2"><label>Category<select value={draft.category} onChange={event => field("category", event.target.value)}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Application deadline (Nairobi time)<input type="datetime-local" required value={draft.deadline} onChange={event => field("deadline", event.target.value)} /><span className="hint">All deadlines use Africa/Nairobi time.</span></label></div>
        {admin ? <label>Application fee in KES<input type="number" min={1} max={250000} step={1} required value={draft.applicationFeeKes} onChange={event => field("applicationFeeKes", event.target.value)} /><span className="hint">The fee becomes locked when an application is started.</span></label> : <p className="text-sm">Application fee: {draft.applicationFeeKes ? formatFee(Number(draft.applicationFeeKes) * 100) : "Awaiting administrator configuration"}</p>}
        <button className="button" disabled={busy || Boolean(job?.organisation.suspendedAt) || (!id && (!draft.organisationId || (!admin && defaultFee == null)))}>{busy ? "Saving…" : "Save draft"}</button>
      </form>}
      {job && <><section className="card employer-job-preview"><p className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-500">Saved posting preview</p><h2 className="text-2xl">{job.title}</h2><p className="my-4 text-sm text-stone-600">{job.location} · {employmentTypes[job.employmentType as keyof typeof employmentTypes] || job.employmentType} · Deadline {formatDeadline(job.deadline)}</p><p className="whitespace-pre-wrap leading-8">{job.description}</p><p className="mt-5 font-semibold">Application fee: {formatFee(job.applicationFeeMinor)}</p></section><details className="card employer-job-history"><summary className="cursor-pointer font-semibold">Posting history</summary><ol className="mt-5 space-y-4">{job.history.map(item => <li key={item.id} className="text-sm"><span className="font-semibold">{item.fromStatus ? `${statusLabels[item.fromStatus]} → ` : ""}{statusLabels[item.toStatus]}</span><span className="ml-3 text-stone-500">{formatDeadline(item.createdAt)}</span>{item.note && <p className="mt-1 whitespace-pre-wrap text-stone-600">{item.note}</p>}</li>)}</ol></details></>}
    </>}
  </div>;
}
