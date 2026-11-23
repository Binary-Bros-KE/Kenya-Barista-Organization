"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { categories, employmentTypes, nairobiToIso } from "@/lib/job-format";

// "Create job posting": every job detail plus a cover photo, in one popup. Saves a draft (and optionally submits
// it for review) using the same APIs as the job editor, so the same rules and checks apply.
type Options = { recruiters: { id: string; name: string | null; email: string }[]; defaultApplicationFeeMinor: number | null };
const MAX_COVER = 8 * 1024 * 1024;

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That didn't work. Please try again.");
  return data;
}

export function CreateJobButton({ admin = false, onCreated }: { admin?: boolean; onCreated: (message: string, openId?: string) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="employer-primary" onClick={() => setOpen(true)}>Create job posting &#43;</button>
    {open && <JobCreateModal admin={admin} onClose={() => setOpen(false)} onCreated={onCreated} />}
  </>;
}

function JobCreateModal({ admin, onClose, onCreated }: { admin: boolean; onClose: () => void; onCreated: (message: string, openId?: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [fee, setFee] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<{ file: File; preview: string } | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    send("/api/employer/job-options", { cache: "no-store" }).then((data: Options) => {
      setOptions(data);
      if (data.defaultApplicationFeeMinor != null) setFee(String(data.defaultApplicationFeeMinor / 100));
    }).catch(problem => setError(problem.message));
  }, []);
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.preview); }, [cover]);

  function chooseCover(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP photo for the cover."); return; }
    if (file.size > MAX_COVER) { setError("Choose a cover photo up to 8 MB."); return; }
    setError(""); setCover({ file, preview: URL.createObjectURL(file) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "submit" ? "submit" : "draft";
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || "").trim();
    setBusy(action); setError("");
    let job: { id: string; version: number } | null = null;
    try {
      job = await send("/api/employer/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        job: { title: text("title"), description: text("description"), location: text("location"), category: text("category"), employmentType: text("employmentType"), deadline: nairobiToIso(text("deadline")), applicationFeeKes: Number(fee) },
      }) });
      if (cover) {
        try { job = await send(`/api/employer/jobs/${job!.id}/cover?version=${job!.version}`, { method: "POST", headers: { "Content-Type": cover.file.type }, body: cover.file }); }
        catch (problem) { throw Object.assign(new Error(`Your job was saved, but the cover photo didn't upload (${(problem as Error).message}). You can add it from the job page.`), { saved: true }); }
      }
      if (action === "submit") {
        // Administrators post as KBO, so their job is approved straight away (submitted, then published).
        try {
          job = await send(`/api/employer/jobs/${job!.id}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: job!.version, action: "submit" }) });
          if (admin) await send(`/api/employer/jobs/${job!.id}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: job!.version, action: "publish" }) });
        }
        catch (problem) { throw Object.assign(new Error(`Your job was saved, but it couldn't be ${admin ? "published" : "submitted"}: ${(problem as Error).message}`), { saved: true }); }
        onCreated(admin ? "Job published. It's live on the jobs page as Kenya Barista Organization." : "Job submitted for review. KBO will check it and publish it, or send it back with feedback.");
        dialog.current?.close();
        return;
      }
      // The draft opens in the manage popup, ready to review and submit.
      onCreated("Draft saved.", job!.id);
      dialog.current?.close();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Your job couldn't be saved.");
      if (job && (problem as { saved?: boolean }).saved) setSaved(job.id);
    } finally { setBusy(""); }
  }

  const today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return <dialog ref={dialog} className="job-create" aria-labelledby="job-create-title" onClose={onClose}>
    <form className="job-create-panel" onSubmit={event => void submit(event)} aria-busy={!!busy}>
      <header className="job-create-head"><div><h2 id="job-create-title">Create a job posting</h2><p>{admin ? "Posted as Kenya Barista Organization. Publish now, or save a draft to finish later." : "KBO reviews every posting before it goes live."}</p></div><button type="button" className="job-create-close" aria-label="Close" onClick={() => dialog.current?.close()}>&times;</button></header>
      <div className="job-create-body">
        <div className={`job-create-cover${cover ? " has-photo" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) chooseCover(file); }}>
          {cover ? <img src={cover.preview} alt="Cover preview" /> : <div><strong>Add a cover photo</strong><span>Optional. A wide photo of your café, team or coffee, at least 1600 × 520. JPG, PNG or WebP, up to 8 MB.</span></div>}
          <div className="job-create-cover-actions">
            <button type="button" className="employer-secondary" onClick={() => coverInput.current?.click()} disabled={!!busy}>{cover ? "Change photo" : "Choose photo"}</button>
            {cover && <button type="button" className="employer-text-button" onClick={() => setCover(null)} disabled={!!busy}>Remove</button>}
          </div>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) chooseCover(file); event.target.value = ""; }} />
        </div>
        <fieldset disabled={!!busy} className="job-create-fields">
          <label className="is-wide">Job title<input name="title" required minLength={5} maxLength={160} placeholder="e.g. Head barista" /></label>
          <label>Location<input name="location" required minLength={2} maxLength={120} placeholder="e.g. Nairobi, Westlands" /></label>
          <label>Employment type<select name="employmentType" defaultValue="FULL_TIME">{Object.entries(employmentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Category<select name="category" defaultValue="BARISTA">{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Application deadline<input name="deadline" type="datetime-local" required min={`${today}T00:00`} /><span>Nairobi time</span></label>
          <label className="is-wide">Job description<textarea name="description" required minLength={50} maxLength={12000} rows={7} value={description} onChange={event => setDescription(event.target.value)} placeholder="Responsibilities, requirements, hours and pay, and what makes your place great to work at." /><span>{description.length.toLocaleString()} / 12,000{description.trim().length < 50 ? ` · at least 50 characters` : ""}</span></label>
          <label>Application fee (KES)<input name="fee" type="number" min={1} max={250000} step={1} required value={fee} onChange={event => setFee(event.target.value)} placeholder="e.g. 250" /><span>What applicants pay to apply. KBO may adjust it before approving the job.</span></label>
        </fieldset>
        {error && <div className="notice error" role="alert">{error}{saved && <> <a className="underline" href={`/${admin ? "admin" : "employer"}/jobs/${saved}`}>Open the job</a></>}</div>}
      </div>
      <footer className="job-create-foot">
        <button type="button" className="employer-text-button" onClick={() => dialog.current?.close()} disabled={!!busy}>Cancel</button>
        <button className="employer-secondary" name="action" value="draft" disabled={!!busy || !options}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        <button className="employer-primary" name="action" value="submit" disabled={!!busy || !options}>{busy === "submit" ? (admin ? "Publishing…" : "Submitting…") : admin ? "Publish now" : "Submit for review"}</button>
      </footer>
    </form>
  </dialog>;
}
