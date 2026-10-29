"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
import { applicationStatusLabels, reviewTransitions } from "@/lib/application-format";
export function RecruitmentActions({ id, version, status, paused }: { id: string; version: number; status: string; paused: boolean }) {
 const router = useRouter(), [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [error,setError] = useState(false);
 const transitions = reviewTransitions[status] || [];
 if (status === "WITHDRAWN") return <section className="employer-panel employer-response-form"><h2>Application withdrawn</h2><p className="employer-inline-warning">The applicant withdrew. Further responses and CV downloads are unavailable.</p></section>;
 if (paused) return <section className="employer-panel employer-response-form"><h2>Responses paused</h2><p className="employer-inline-warning">This organisation is suspended. Responses are paused.</p></section>;
 return <form key={version} className="employer-panel employer-response-form" aria-busy={busy} onSubmit={async event => {
 event.preventDefault(); setBusy(true); setMessage(""); setError(false); const form=event.currentTarget, values=new FormData(form);
 try { await postJson("/api/employer/applications/"+id+"/responses", { version, message: values.get("message"), ...(values.get("status") ? { status: values.get("status") } : {}) }); form.reset(); setMessage("Response saved and visible to the applicant."); router.refresh(); }
 catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "Unable to send response."); router.refresh(); } finally { setBusy(false); }
 }}><span className="employer-eyebrow">KEEP THE CONVERSATION MOVING</span><h2>Respond to the applicant</h2><p>Send a helpful update and choose the next step when you are ready.</p><fieldset disabled={busy}><label htmlFor="recruitment-action">Recruitment action<select id="recruitment-action" name="status"><option value="">Send a message without changing status</option>{transitions.map(next => <option key={next} value={next}>{applicationStatusLabels[next as keyof typeof applicationStatusLabels]}</option>)}</select></label><label htmlFor="recruitment-message">Message to the applicant<textarea id="recruitment-message" name="message" minLength={2} maxLength={4000} rows={7} required placeholder="Share feedback, interview arrangements or the next steps for this role."/></label></fieldset><p className="employer-response-note">Every message here is visible to the applicant. Status changes are final once marked Hired or Not selected.</p><button className="employer-primary" disabled={busy}>{busy ? "Sending..." : "Send response"}</button><p role={error?"alert":"status"} className={message?"employer-feedback "+(error?"is-error":"is-success"):""}>{message}</p></form>;
}
export function WithdrawApplication({ id, version }: { id: string; version: number }) {
 const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
 return <details className="application-withdraw"><summary><div><strong>Need to step back?</strong><span>Withdraw this application</span></div><span aria-hidden="true">&#8964;</span></summary><form onSubmit={async event => {
  event.preventDefault(); setBusy(true); setMessage(""); const values = new FormData(event.currentTarget);
  try { await postJson("/api/applications/"+id+"/withdraw", { version, reason: values.get("reason") }); router.refresh(); }
  catch (failure) { setMessage(failure instanceof Error ? failure.message : "Unable to withdraw your application."); router.refresh(); } finally { setBusy(false); }
 }}><p>Withdrawal stops further consideration and employer CV downloads. It cannot be undone through this dashboard and does not automatically refund the application fee.</p><fieldset disabled={busy}><label htmlFor="withdraw-reason">Reason <span>Optional</span><textarea id="withdraw-reason" name="reason" maxLength={2000} rows={3} placeholder="Let the recruitment team know why you are withdrawing." /></label><label className="application-withdraw-check"><input type="checkbox" required /><span>I understand and want to withdraw this application.</span></label></fieldset><button className="application-danger" disabled={busy}>{busy ? "Withdrawing..." : "Confirm withdrawal"}</button><p role="alert" className={message ? "application-feedback is-error" : ""}>{message}</p></form></details>;
}
