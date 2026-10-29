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
 const router = useRouter(); const [currentVersion,setVersion] = useState(version); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 useEffect(()=>setVersion(version),[version]);
 return <form className="card form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); const form = new FormData(e.currentTarget); try { const result = await put("/api/applications/"+id, { version: currentVersion, coverLetter: form.get("coverLetter"), documentId: form.get("documentId") || null }); setVersion(result.version); setMessage("Draft saved"); router.refresh(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>
 <label>Cover letter<textarea name="coverLetter" rows={8} maxLength={6000} defaultValue={coverLetter} disabled={!editable} /></label>
 <label>Attach a CV<select name="documentId" defaultValue={selected} disabled={!editable}><option value="">Choose a CV</option>{documents.filter(d=>d.scanStatus==="PENDING" || d.scanStatus==="CLEAN").map(d=><option key={d.id} value={d.id}>{d.filename} ({d.scanStatus})</option>)}</select></label>
 <p className="hint">Upload and manage CVs on your profile page.</p><button className="button" disabled={busy || !editable}>{busy ? "Saving..." : "Save draft"}</button><p role="status">{message}</p></form>;
}

