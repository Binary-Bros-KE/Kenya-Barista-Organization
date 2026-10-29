"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export function NotificationPreference({enabled}:{enabled:boolean}){
 const [checked,setChecked]=useState(enabled),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 return <form className="card form-stack mb-8" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const response=await fetch("/api/notifications/preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({emailEnabled:checked})});const data=await response.json();if(!response.ok)throw new Error(data.message);setMessage("Email preference saved.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
 <h2>Email preferences</h2><label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />Email me job and application updates</label><p className="hint">Dashboard alerts remain available. Account verification and security emails use the account recovery process.</p><button className="button w-fit" disabled={busy}>{busy?"Saving...":"Save preference"}</button><p role="status">{message}</p></form>;
}
export function MarkNotificationRead({id}:{id:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 return <div><button className="underline text-sm" disabled={busy} onClick={async()=>{setBusy(true);try{await postJson("/api/notifications/"+id+"/read",{});router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Mark as read</button><p role="status">{message}</p></div>;
}
export function RetryNotification({id,target}:{id:string;target:"event"|"delivery"}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 return <div><button className="button secondary mt-3" disabled={busy} onClick={async()=>{setBusy(true);try{await postJson("/api/admin/notifications/retry",{id,target});setMessage("Queued for the worker.");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Retry failed {target==="event"?"event":"email"}</button><p role="status">{message}</p></div>;
}

