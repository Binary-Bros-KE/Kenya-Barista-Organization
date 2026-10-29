"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
import { applicationStatusLabels,reviewTransitions } from "@/lib/application-format";
export function RecruitmentActions({id,version,status,paused}:{id:string;version:number;status:string;paused:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const transitions=reviewTransitions[status]||[];
 if(status==="WITHDRAWN")return <p className="notice">The applicant withdrew. Further responses and CV downloads are unavailable.</p>;
 if(paused)return <p className="notice">This organisation is suspended. Responses are paused.</p>;
 return <form key={version} className="card form-stack" onSubmit={async e=>{
 e.preventDefault();setBusy(true);setMessage("");const form=e.currentTarget,values=new FormData(form);
 try{await postJson("/api/employer/applications/"+id+"/responses",{version,message:values.get("message"),...(values.get("status")?{status:values.get("status")}:{})});form.reset();setMessage("Response saved and visible to the applicant.");router.refresh();}
 catch(e){setMessage((e as Error).message);router.refresh();}finally{setBusy(false);}
 }}>
 <h2>Respond to the applicant</h2><label>Action<select name="status"><option value="">Send a response without changing status</option>{transitions.map(s=><option key={s} value={s}>{applicationStatusLabels[s as keyof typeof applicationStatusLabels]}</option>)}</select></label>
 <label>Message to the applicant<textarea name="message" minLength={2} maxLength={4000} rows={6} required /></label>
 <p className="hint">Every message here is visible to the applicant. Status changes are final once marked Hired or Not selected.</p><button disabled={busy} className="button">{busy?"Saving...":"Send response"}</button><p role="status">{message}</p></form>;
}
export function WithdrawApplication({ id, version }: { id: string; version: number }) {
 const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
 return <details className="application-withdraw"><summary><div><strong>Need to step back?</strong><span>Withdraw this application</span></div><span aria-hidden="true">?</span></summary><form onSubmit={async event => {
  event.preventDefault(); setBusy(true); setMessage(""); const values = new FormData(event.currentTarget);
  try { await postJson("/api/applications/"+id+"/withdraw", { version, reason: values.get("reason") }); router.refresh(); }
  catch (failure) { setMessage(failure instanceof Error ? failure.message : "Unable to withdraw your application."); router.refresh(); } finally { setBusy(false); }
 }}><p>Withdrawal stops further consideration and employer CV downloads. It cannot be undone through this dashboard and does not automatically refund the application fee.</p><fieldset disabled={busy}><label htmlFor="withdraw-reason">Reason <span>Optional</span><textarea id="withdraw-reason" name="reason" maxLength={2000} rows={3} placeholder="Let the recruitment team know why you are withdrawing." /></label><label className="application-withdraw-check"><input type="checkbox" required /><span>I understand and want to withdraw this application.</span></label></fieldset><button className="application-danger" disabled={busy}>{busy ? "Withdrawing?" : "Confirm withdrawal"}</button><p role="alert" className={message ? "application-feedback is-error" : ""}>{message}</p></form></details>;
}
