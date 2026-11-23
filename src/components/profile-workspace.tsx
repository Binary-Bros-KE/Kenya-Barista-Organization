"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CvViewButton, PdfThumbnail } from "./cv-viewer";
export type ProfileCv = { id: string; filename: string; scanStatus: string; sizeBytes?: number; createdAt?: string; attachmentCount?: number };
export function cvPresentation(status: string) {
  if (status === "CLEAN") return { label: "Ready to apply", detail: "Security screening complete.", tone: "ready", downloadable: true };
  if (status === "PENDING") return { label: "Screening", detail: "We're running a quick security check. You can already apply with it; recruiters can open it once the check finishes.", tone: "pending", downloadable: true };
  return { label: status === "REJECTED" ? "Not approved" : "Unavailable", detail: "This file cannot be used. Remove it and upload another PDF.", tone: "blocked", downloadable: false };
}
export function validateCvSelection(file: { name: string; size: number }) {
  if (!file.size) return "Choose a PDF that is not empty.";
  if (file.size > 5 * 1024 * 1024) return "Choose a PDF up to 5 MB.";
  if (!/\.pdf$/i.test(file.name)) return "Choose a file with a .pdf extension.";
  return "";
}
function Feedback({ message, error }: { message: string; error: boolean }) {
  return <p role={error ? "alert" : "status"} className={message ? "profile-feedback " + (error ? "is-error" : "is-success") : "profile-feedback-empty"}>{message}</p>;
}
export function CvManager({ documents }: { documents: ProfileCv[] }) {
  const router = useRouter(); const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null); const [removing, setRemoving] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const hasCv = documents.length > 0;
  function fail(text: string) { setError(true); setMessage(text); }
  function cancelReplace() { setReplacing(false); setSelected(null); setMessage(""); }
  const date = (value: string) => new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(value));
  return <section className="profile-panel profile-documents" aria-labelledby="profile-cv-heading" aria-busy={busy || refreshing}>
    <div className="profile-panel-heading"><span className="profile-step">06</span><div><h2 id="profile-cv-heading">Your CV</h2><p>One CV, always up to date. Uploading a new one replaces it.</p></div></div>
    {!hasCv && <div className="profile-empty"><strong>Your next chapter starts here.</strong><p>Upload a CV so it is ready when you find the right role.</p></div>}
    {(!hasCv || replacing) && <form className="profile-upload" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget;
      if (!selected) { fail("Choose a PDF to upload."); return; }
      const validation = validateCvSelection(selected); if (validation) { fail(validation); return; }
      setBusy(true); setMessage(""); setError(false);
      try { const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/pdf", "X-Filename": selected.name.replace(/[^a-zA-Z0-9 ._-]/g, "_") }, body: selected });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to upload your CV.");
        form.reset(); setSelected(null); setReplacing(false); setMessage(data.replaced ? `CV replaced.${data.movedDrafts ? ` ${data.movedDrafts} draft application${data.movedDrafts === 1 ? " now uses" : "s now use"} it.` : ""} Security screening is pending.` : "CV uploaded. Security screening is pending."); router.refresh();
      } catch (failure) { fail(failure instanceof Error ? failure.message : "Unable to upload your CV."); } finally { setBusy(false); }
    }}>
      <span className="profile-file-symbol" aria-hidden="true">&#8593;</span><label htmlFor="profile-cv-file">{hasCv ? "Replace your CV" : "Add your CV"}<input id="profile-cv-file" name="cv" type="file" accept=".pdf,application/pdf" required disabled={busy} aria-describedby="profile-upload-help" onChange={event => { const file = event.target.files?.[0] || null; setSelected(file); setMessage(""); if (file) { const validation = validateCvSelection(file); if (validation) fail(validation); } }} /></label>
      <p id="profile-upload-help" className="profile-help">PDF only &middot; Up to 5 MB{hasCv ? " · Your draft applications switch to the new CV; applications you've already sent keep the one you sent" : ""}</p>
      {selected && <p className="profile-selection">{selected.name} <span>({(selected.size / 1024 / 1024).toFixed(2)} MB)</span></p>}
      <div className="profile-upload-actions">
        {replacing && <button type="button" className="profile-text-button" disabled={busy} onClick={cancelReplace}>Cancel</button>}
        <button className="profile-primary" disabled={busy || !selected || !!validateCvSelection(selected)}>{busy ? "Uploading..." : hasCv ? "Replace CV" : "Upload CV"}</button>
      </div>
    </form>}
    {hasCv && <ul className="profile-document-list">{documents.map(doc => { const state = cvPresentation(doc.scanStatus); const attached = !!doc.attachmentCount; const href = "/api/documents/" + doc.id;
      const thumb = <PdfThumbnail src={state.downloadable ? href : null} width={118} />;
      return <li key={doc.id} className={"cv-card is-" + state.tone}>
        <div className="cv-card-preview">{state.downloadable ? <CvViewButton src={href} downloadHref={href} filename={doc.filename} className="cv-card-thumb">{thumb}<span className="cv-card-thumb-hint" aria-hidden="true">View</span></CvViewButton> : thumb}</div>
        <div className="cv-card-body">
          <div className="cv-card-top"><span className={"profile-state " + state.tone}>{state.label}</span>{state.tone === "pending" && <button className="profile-text-button" disabled={busy || refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Refreshing..." : "Refresh status"}</button>}</div>
          <h3 className="cv-card-name" title={doc.filename}>{doc.filename}</h3>
          <p className="cv-card-meta"><span>PDF document</span>{doc.sizeBytes !== undefined && <span>{(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>}{doc.createdAt && <span>Uploaded {date(doc.createdAt)}</span>}</p>
          <p className="cv-card-detail">{state.detail}</p>
          {attached && <p className="profile-help">Attached to an application, so it can't be removed. Replace it instead: your drafts switch to the new CV, and applications you've sent keep this one.</p>}
          <div className="cv-card-actions">
            {state.downloadable && <CvViewButton src={href} downloadHref={href} filename={doc.filename} className="cv-view-button is-light" />}
            {state.downloadable && <a className="cv-card-link" href={href}>Download <span aria-hidden="true">&#8595;</span></a>}
            {!replacing && <button type="button" className="cv-card-replace" disabled={busy} onClick={() => { setReplacing(true); setRemoving(null); setMessage(""); }}>Replace CV</button>}
            <button className="profile-remove" disabled={busy || attached} onClick={() => { setRemoving(doc.id); setMessage(""); }}>Remove<span className="sr-only"> {doc.filename}</span></button>
          </div>
        </div>
        {removing === doc.id && <div className="profile-confirm"><p>Remove <strong>{doc.filename}</strong>? You'll need a CV to apply for jobs.</p><div><button className="profile-danger" disabled={busy} onClick={async () => {
          setBusy(true); setMessage(""); setError(false);
          try { const response = await fetch("/api/documents/" + doc.id, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to remove your CV."); setRemoving(null); setMessage("CV removed."); router.refresh(); }
          catch (failure) { fail(failure instanceof Error ? failure.message : "Unable to remove your CV."); } finally { setBusy(false); }
        }}>{busy ? "Removing..." : "Yes, remove CV"}</button><button className="profile-text-button" disabled={busy} onClick={() => setRemoving(null)}>Keep CV</button></div></div>}
      </li>;
    })}</ul>}
    <Feedback message={message} error={error} />
    <p className="profile-security-note">Private by design. CVs are stored outside the public website and screened before they can be submitted with an application.</p>
  </section>;
}
