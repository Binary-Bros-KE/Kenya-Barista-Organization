"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
async function put(url: string, body: unknown) { const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to save"); return data; }
export function ProfileForm({ initial }: { initial: { fullName: string; phone: string; location: string; summary: string } }) {
 const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
 return <form className="card form-stack max-w-2xl" onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(e.currentTarget); try { await put("/api/profile", Object.fromEntries(form)); setMessage("Profile saved"); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>
 <label>Full name<input name="fullName" required minLength={2} maxLength={120} defaultValue={initial.fullName} autoComplete="name" /></label>
 <label>Mobile number<input name="phone" required pattern="\\+254[17][0-9]{8}" placeholder="+254712345678" defaultValue={initial.phone} autoComplete="tel" /><span className="hint">Use +254 followed by your mobile number.</span></label>
 <label>Location<input name="location" required minLength={2} maxLength={120} defaultValue={initial.location} autoComplete="address-level2" /></label>
 <label>Professional summary<textarea name="summary" maxLength={3000} rows={5} defaultValue={initial.summary} /></label>
 <button className="button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button><p role="status">{message}</p></form>;
}
export function StartApplication({ slug }: { slug: string }) {
 const router = useRouter(); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 return <div><button className="button" disabled={busy} onClick={async () => { setBusy(true); try { const result = await postJson("/api/applications", { slug }); router.push("/dashboard/applications/" + result.id); } catch(e) { setMessage((e as Error).message); setBusy(false); } }}>{busy ? "Opening..." : "Start or resume application"}</button><p role="alert">{message}</p></div>;
}
type CV = { id: string; filename: string; scanStatus: string };
export function CvManager({ documents }: { documents: CV[] }) {
 const router = useRouter(); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 return <div className="card form-stack"><h2>Your CVs</h2><p className="hint">PDF only, up to 5 MB. Five CVs maximum. Uploaded files await security screening before they can be submitted.</p>
 <form className="form-stack" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const file = new FormData(form).get("cv"); if (!(file instanceof File) || !file.size) return; if (file.size > 5*1024*1024) { setMessage("Choose a PDF up to 5 MB"); return; } setBusy(true); setMessage(""); try { const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/pdf", "X-Filename": file.name.replace(/[^a-zA-Z0-9 ._-]/g,"_") }, body: file }); const data = await response.json(); if (!response.ok) throw new Error(data.message); form.reset(); setMessage("CV uploaded. Security screening pending."); router.refresh(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>
 <label>Upload a CV<input type="file" name="cv" accept=".pdf,application/pdf" required /></label><button className="button" disabled={busy}>Upload CV</button></form>
 {documents.map(doc => <div key={doc.id} className="flex flex-wrap items-center gap-4 border-t pt-4"><a className="underline" href={"/api/documents/"+doc.id}>{doc.filename}</a><span className="badge">{doc.scanStatus}</span><button disabled={busy} onClick={async () => { setBusy(true); try { const response = await fetch("/api/documents/"+doc.id, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setMessage("CV removed"); router.refresh(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>Remove</button></div>)}<p role="status">{message}</p></div>;
}
export function DraftForm({ id, version, coverLetter, selected, documents, editable }: { id: string; version: number; coverLetter: string; selected: string; documents: CV[]; editable: boolean }) {
 const router = useRouter(); const [currentVersion,setVersion] = useState(version); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 useEffect(()=>setVersion(version),[version]);
 return <form className="card form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); const form = new FormData(e.currentTarget); try { const result = await put("/api/applications/"+id, { version: currentVersion, coverLetter: form.get("coverLetter"), documentId: form.get("documentId") || null }); setVersion(result.version); setMessage("Draft saved"); router.refresh(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>
 <label>Cover letter<textarea name="coverLetter" rows={8} maxLength={6000} defaultValue={coverLetter} disabled={!editable} /></label>
 <label>Attach a CV<select name="documentId" defaultValue={selected} disabled={!editable}><option value="">Choose a CV</option>{documents.filter(d=>d.scanStatus==="PENDING" || d.scanStatus==="CLEAN").map(d=><option key={d.id} value={d.id}>{d.filename} ({d.scanStatus})</option>)}</select></label>
 <p className="hint">Upload and manage CVs on your profile page.</p><button className="button" disabled={busy || !editable}>{busy ? "Saving..." : "Save draft"}</button><p role="status">{message}</p></form>;
}

