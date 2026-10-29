"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export type ProfileCv = { id: string; filename: string; scanStatus: string; sizeBytes?: number; createdAt?: string; attachmentCount?: number };
export function cvPresentation(status: string) {
  if (status === "CLEAN") return { label: "Ready to apply", detail: "Security screening complete.", tone: "ready", downloadable: true };
  if (status === "PENDING") return { label: "Screening", detail: "Your original is available. Wait for screening before submitting an application.", tone: "pending", downloadable: true };
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
export function ProfileForm({ initial }: { initial: { fullName: string; phone: string; location: string; summary: string } }) {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(initial.summary);
  return <form className="profile-panel profile-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage(""); setError(false);
    try { const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Unable to save your profile.");
      setMessage("Your profile has been saved."); router.refresh();
    } catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "Unable to save your profile."); }
    finally { setBusy(false); }
  }}>
    <div className="profile-panel-heading"><span className="profile-step">01</span><div><h2>Professional details</h2><p>Introduce yourself to your next employer.</p></div></div>
    <fieldset disabled={busy}><legend>Contact information</legend><p className="profile-help">These details are required when applying for a job.</p>
      <label htmlFor="profile-name">Full name<input id="profile-name" name="fullName" required minLength={2} maxLength={120} defaultValue={initial.fullName} autoComplete="name" /></label>
      <div className="profile-field-pair"><label htmlFor="profile-phone">Mobile number<input id="profile-phone" type="tel" name="phone" required pattern={"\\+254[17][0-9]{8}"} placeholder="+254712345678" defaultValue={initial.phone} autoComplete="tel" aria-describedby="profile-phone-help" /><span id="profile-phone-help" className="profile-help">Use +254 followed by your mobile number.</span></label>
      <label htmlFor="profile-location">Location<input id="profile-location" name="location" required minLength={2} maxLength={120} defaultValue={initial.location} placeholder="e.g. Nairobi, Kenya" autoComplete="address-level2" /></label></div>
    </fieldset>
    <fieldset disabled={busy}><legend>Your experience</legend><label htmlFor="profile-summary">Professional summary <span className="profile-optional">Optional</span><textarea id="profile-summary" name="summary" maxLength={3000} rows={6} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Tell employers about your coffee skills, experience and career interests." aria-describedby="profile-summary-help" /></label><p id="profile-summary-help" className="profile-help profile-character-count">{summary.length.toLocaleString()} / 3,000 characters</p></fieldset>
    <div className="profile-save"><p>You can update these details at any time.</p><button className="profile-primary" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
    <Feedback message={message} error={error} />
  </form>;
}
export function CvManager({ documents }: { documents: ProfileCv[] }) {
  const router = useRouter(); const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<File | null>(null); const [removing, setRemoving] = useState<string | null>(null);
  const full = documents.length >= 5;
  function fail(text: string) { setError(true); setMessage(text); }
  return <section className="profile-panel profile-documents" aria-labelledby="profile-cv-heading" aria-busy={busy || refreshing}>
    <div className="profile-panel-heading"><span className="profile-step">02</span><div><h2 id="profile-cv-heading">Your CV collection</h2><p>Keep your best experience ready to share.</p></div><span className="profile-capacity">{documents.length} / 5</span></div>
    <form className="profile-upload" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget;
      if (!selected) { fail("Choose a PDF to upload."); return; }
      const validation = validateCvSelection(selected); if (validation) { fail(validation); return; }
      setBusy(true); setMessage(""); setError(false);
      try { const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/pdf", "X-Filename": selected.name.replace(/[^a-zA-Z0-9 ._-]/g, "_") }, body: selected });
        const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to upload your CV.");
        form.reset(); setSelected(null); setMessage("CV uploaded. Security screening is pending."); router.refresh();
      } catch (failure) { fail(failure instanceof Error ? failure.message : "Unable to upload your CV."); } finally { setBusy(false); }
    }}>
      <span className="profile-file-symbol" aria-hidden="true">&#8593;</span><label htmlFor="profile-cv-file">Add your next opportunity<input id="profile-cv-file" name="cv" type="file" accept=".pdf,application/pdf" required disabled={busy || full} aria-describedby="profile-upload-help" onChange={event => { const file = event.target.files?.[0] || null; setSelected(file); setMessage(""); if (file) { const validation = validateCvSelection(file); if (validation) fail(validation); } }} /></label>
      <p id="profile-upload-help" className="profile-help">PDF only &middot; Up to 5 MB per file &middot; Five CVs maximum</p>
      {selected && <p className="profile-selection">{selected.name} <span>({(selected.size / 1024 / 1024).toFixed(2)} MB)</span></p>}
      {full && <p className="profile-help">Your collection is full. Remove an unused CV before adding another.</p>}
      <button className="profile-primary" disabled={busy || full || !selected || !!validateCvSelection(selected)}>{busy ? "Uploading..." : "Upload CV"}</button>
    </form>
    <div className="profile-document-heading"><h3>Saved documents</h3><button className="profile-text-button" disabled={busy || refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Refreshing..." : "Refresh status"}</button></div>
    {!documents.length && <div className="profile-empty"><strong>Your next chapter starts here.</strong><p>Upload a CV so it is ready when you find the right role.</p></div>}
    <ul className="profile-document-list">{documents.map(doc => { const state = cvPresentation(doc.scanStatus); const attached = !!doc.attachmentCount;
      return <li key={doc.id} className="profile-document"><div className="profile-document-top"><span className="profile-pdf" aria-hidden="true">PDF</span><div className="profile-document-name"><h3>{doc.filename}</h3><p>{doc.sizeBytes !== undefined && (doc.sizeBytes / 1024 / 1024).toFixed(2) + " MB"}{doc.createdAt && " - " + new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(doc.createdAt))}</p></div><span className={"profile-state " + state.tone}>{state.label}</span></div>
        <p className="profile-document-detail">{state.detail}</p>{attached && <p className="profile-help">Attached to an application. Detach it from drafts before removing it. Submitted attachments are retained.</p>}
        <div className="profile-document-actions">{state.downloadable && <a href={"/api/documents/" + doc.id}>Download original <span aria-hidden="true">&#8595;</span></a>}
          <button className="profile-remove" disabled={busy || attached} onClick={() => { setRemoving(doc.id); setMessage(""); }}>Remove<span className="sr-only"> {doc.filename}</span></button></div>
        {removing === doc.id && <div className="profile-confirm"><p>Remove <strong>{doc.filename}</strong> from your collection?</p><div><button className="profile-danger" disabled={busy} onClick={async () => {
          setBusy(true); setMessage(""); setError(false);
          try { const response = await fetch("/api/documents/" + doc.id, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to remove your CV."); setRemoving(null); setMessage("CV removed."); router.refresh(); }
          catch (failure) { fail(failure instanceof Error ? failure.message : "Unable to remove your CV."); } finally { setBusy(false); }
        }}>{busy ? "Removing..." : "Yes, remove CV"}</button><button className="profile-text-button" disabled={busy} onClick={() => setRemoving(null)}>Keep CV</button></div></div>}
      </li>;
    })}</ul>
    <Feedback message={message} error={error} />
    <p className="profile-security-note">Private by design. CVs are stored outside the public website and screened before they can be submitted with an application.</p>
  </section>;
}
