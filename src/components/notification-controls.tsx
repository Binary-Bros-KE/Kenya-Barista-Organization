"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export function NotificationPreference({ enabled }: { enabled: boolean }) {
 const [checked, setChecked] = useState(enabled), [saved, setSaved] = useState(enabled), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
 return <form className="activity-panel inbox-preferences" aria-busy={busy} onSubmit={async event => {
 event.preventDefault(); setBusy(true); setMessage(""); setError(false);
 try { const response = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailEnabled: checked }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to save your preference."); setSaved(checked); setMessage("Email preference saved."); }
 catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "Unable to save your preference."); } finally { setBusy(false); }
 }}><span className="activity-eyebrow">YOUR PREFERENCES</span><h2>Stay connected</h2><p>Choose whether to receive job and application updates by email.</p><label className="inbox-preference-option"><input type="checkbox" checked={checked} disabled={busy} onChange={event => { setChecked(event.target.checked); setMessage(""); }} /><span><strong>Email notifications</strong><span>Email me job and application updates</span></span></label><p className="inbox-preference-help">Dashboard alerts remain available. Verification and security emails are handled separately.</p><button className="activity-button" disabled={busy || checked === saved}>{busy ? "Saving?" : "Save preference"}</button><p role={error ? "alert" : "status"} className={message ? "activity-feedback " + (error ? "is-error" : "is-success") : ""}>{message}</p></form>;
}
export function MarkNotificationRead({ id }: { id: string }) {
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const router = useRouter();
 return <div className="inbox-read-control"><button disabled={busy} onClick={async () => { setBusy(true); setMessage(""); try { await postJson("/api/notifications/"+id+"/read", {}); router.refresh(); } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Unable to mark this update as read."); } finally { setBusy(false); } }}>{busy ? "Marking?" : "Mark as read"}</button><p role="alert">{message}</p></div>;
}
export function RetryNotification({id,target}:{id:string;target:"event"|"delivery"}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 return <div><button className="button secondary mt-3" disabled={busy} onClick={async()=>{setBusy(true);try{await postJson("/api/admin/notifications/retry",{id,target});setMessage("Queued for the worker.");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Retry failed {target==="event"?"event":"email"}</button><p role="status">{message}</p></div>;
}

