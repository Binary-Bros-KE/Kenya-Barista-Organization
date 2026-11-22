"use client";
import { useRef, useState } from "react";
import { JobCover } from "./job-cover";

const MAX_COVER = 8 * 1024 * 1024;
type Job = { id: string; version: number; status: string; category: string; coverVersion: number | null };

// Upload, replace or remove a job's cover photo from the job editor.
export function JobCoverEditor({ job, imagesEnabled, blocked, onChanged }: { job: Job; imagesEnabled: boolean; blocked: string; onChanged: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const editable = ["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW", "PUBLISHED"].includes(job.status);

  async function send(method: "POST" | "DELETE", file?: File) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/employer/jobs/${job.id}/cover?version=${job.version}`, { method, credentials: "same-origin", ...(file ? { headers: { "Content-Type": file.type }, body: file } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "The cover could not be updated. Try again.");
      await onChanged();
      setMessage({ text: method === "POST" ? `Cover updated.${job.status === "PUBLISHED" ? " The posting is back in draft; submit it for review to publish it again." : ""}` : "Cover removed. The branded cover shows instead.", error: false });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "The cover could not be updated.", error: true }); }
    finally { setBusy(false); setPreview(current => { if (current) URL.revokeObjectURL(current); return null; }); if (input.current) input.current.value = ""; }
  }
  function choose(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage({ text: "Choose a JPG, PNG or WebP photo.", error: true }); return; }
    if (file.size > MAX_COVER) { setMessage({ text: "Choose a photo up to 8 MB.", error: true }); return; }
    setPreview(URL.createObjectURL(file));
    void send("POST", file);
  }

  return <section className="card employer-cover">
    <div className="employer-section-heading"><div><span className="employer-eyebrow">COVER PHOTO</span><h2>Make it look like your place</h2></div></div>
    <div className="employer-cover-frame">
      {preview ? <div className="job-cover is-hero has-photo"><img src={preview} alt="" /></div> : <JobCover id={job.id} coverVersion={job.coverVersion} category={job.category} size="hero" />}
      {busy && <span className="employer-cover-busy">Uploading…</span>}
    </div>
    {!imagesEnabled ? <p className="hint">Photo uploads aren't set up yet. Jobs show a branded cover until then.</p>
      : !editable ? <p className="hint">Reopen this posting to change its cover.</p>
      : <>
        <p className="hint">A wide photo of your café, team or coffee works best (at least 1600 × 520). JPG, PNG or WebP, up to 8 MB.{job.status === "PUBLISHED" ? " Changing the cover of a live posting sends it back for review." : ""}</p>
        {blocked && <p className="hint">{blocked}</p>}
        <div className="employer-cover-actions">
          <button type="button" className="button secondary" disabled={busy || !!blocked} onClick={() => input.current?.click()}>{job.coverVersion ? "Change cover" : "Upload cover"}</button>
          {job.coverVersion && <button type="button" className="underline" disabled={busy || !!blocked} onClick={() => void send("DELETE")}>Remove cover</button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) choose(file); }} />
      </>}
    {message && <p className={`notice ${message.error ? "error" : "success"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
  </section>;
}
