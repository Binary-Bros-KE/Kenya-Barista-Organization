"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
async function put(url: string, body: unknown) { const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to save"); return data; }
export { ProfileForm, CvManager } from "./profile-workspace";

export function StartApplication({ slug }: { slug: string }) {
 const router = useRouter(); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 return <div><button className="button" disabled={busy} onClick={async () => { setBusy(true); try { const result = await postJson("/api/applications", { slug }); router.push("/dashboard/applications/" + result.id); } catch(e) { setMessage((e as Error).message); setBusy(false); } }}>{busy ? "Opening..." : "Start or resume application"}</button><p role="alert">{message}</p></div>;
}
type CV = { id: string; filename: string; scanStatus: string };
export function DraftForm({ id, version, coverLetter, selected, documents, editable }: { id: string; version: number; coverLetter: string; selected: string; documents: CV[]; editable: boolean }) {
 const router = useRouter(); const [currentVersion, setVersion] = useState(version); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [dirty, setDirty] = useState(false); const [letter, setLetter] = useState(coverLetter);
 useEffect(() => setVersion(version), [version]);
 const available = documents.filter(doc => doc.scanStatus === "PENDING" || doc.scanStatus === "CLEAN");
 const attached = documents.find(doc => doc.id === selected);
 if (!editable) return <section className="application-panel application-saved"><div className="application-section-heading"><div><span className="application-eyebrow">SAVED DETAILS</span><h2>Your application</h2></div><span className="application-lock">Read only</span></div><h3>Cover letter</h3><p className="application-letter">{coverLetter || "No cover letter was included."}</p><h3>Attached CV</h3><p>{attached?.filename || "No CV is attached."}</p><p className="application-help">These saved details cannot be edited while payment is unresolved or after submission.</p></section>;
 return <form className="application-panel application-draft" aria-busy={busy} onChange={() => { setDirty(true); setMessage(""); }} onSubmit={async event => {
  event.preventDefault(); setBusy(true); setMessage(""); setError(false); const form = new FormData(event.currentTarget);
  try { const result = await put("/api/applications/"+id, { version: currentVersion, coverLetter: form.get("coverLetter"), documentId: form.get("documentId") || null }); setVersion(result.version); setMessage("Draft saved. Your latest details are ready for the next step."); setDirty(false); router.refresh(); }
  catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "Unable to save your draft."); }
  finally { setBusy(false); }
 }}><div className="application-section-heading"><div><span className="application-eyebrow">PREPARE YOUR APPLICATION</span><h2>Tell your story</h2></div><span className={"application-draft-state"+(dirty?" is-unsaved":"")}>{dirty ? "Unsaved changes" : "Saved draft"}</span></div>
  <fieldset disabled={busy}><label htmlFor="application-cover-letter">Cover letter <span>Optional</span><textarea id="application-cover-letter" name="coverLetter" rows={9} maxLength={6000} value={letter} onChange={event => setLetter(event.target.value)} placeholder="Share your experience, what you would bring to the team and why this role interests you." aria-describedby="application-letter-help" /></label><p id="application-letter-help" className="application-character-count">{letter.length.toLocaleString()} / 6,000 characters</p>
  <label htmlFor="application-document">Attach your CV<select id="application-document" name="documentId" defaultValue={available.some(doc => doc.id === selected) ? selected : ""} aria-describedby="application-document-help"><option value="">Choose a CV</option>{available.map(doc => <option key={doc.id} value={doc.id}>{doc.filename} ? {doc.scanStatus === "CLEAN" ? "Ready" : "Screening"}</option>)}</select></label>
  <p id="application-document-help" className="application-help">You can save a draft with a CV that is still screening. It must pass screening before you pay and submit.</p>
  {selected && !available.some(doc => doc.id === selected) && <p className="application-warning">Your attached CV is unavailable. Choose another CV and save your draft.</p>}
  {!available.length && <p className="application-warning">No available CVs yet. <a href="/dashboard/profile">Upload a PDF on your profile</a>, then return to attach it.</p>}</fieldset>
  <div className="application-draft-footer"><p>Save your changes before requesting payment.</p><button className="application-primary" disabled={busy}>{busy ? "Saving..." : "Save draft"}</button></div><p className={message ? "application-feedback " + (error ? "is-error" : "is-success") : ""} role={error ? "alert" : "status"}>{message}</p>
 </form>;
}
