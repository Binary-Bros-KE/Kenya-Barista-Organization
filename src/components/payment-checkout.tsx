"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
import { formatFee } from "@/lib/job-format";
type Option={id:string;label:string;kind:"PAYBILL"|"TILL";environment:"SANDBOX"|"LIVE";businessShortCode:string;tillNumber:string|null};
export function PaymentCheckout({applicationId,version,amountMinor,phone,options,status,reviewHold=false,applicationStatus,receipt,reviewReason}:{applicationId:string;version:number;amountMinor:number;phone:string;options:Option[];status:string|null;reviewHold?:boolean;applicationStatus:string;receipt:string|null;reviewReason:string|null}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const key=useRef<string|null>(null);const router=useRouter();
 useEffect(()=>{
  if(applicationStatus!=="DRAFT"||!status||!["PENDING","NEEDS_REVIEW"].includes(status))return;
  let active=true,checking=false;
  const timer=setInterval(async()=>{if(checking)return;checking=true;try{await postJson("/api/applications/"+applicationId+"/payments/refresh",{});if(active)router.refresh();}catch{/* Manual status checking remains available after a transient error. */}finally{checking=false;}},30000);
  return()=>{active=false;clearInterval(timer);};
 },[applicationId,applicationStatus,status,router]);
 const terminal=applicationStatus!=="DRAFT";const blocked=reviewHold||!!status&&["PENDING","NEEDS_REVIEW","SUCCEEDED","REFUNDED"].includes(status);
 return <section className="card form-stack mt-6"><h2>Application payment</h2><p>Application fee: <strong>{formatFee(amountMinor)}</strong></p>
 {reviewHold&&<p className="notice error">Your payment is on hold for administrator review. Do not pay again. Contact support with your application reference.</p>}
 {status&&<p className="notice">Payment: {status==="REFUNDED"?"REVERSED":status.replaceAll("_"," ")}{receipt?" · Receipt "+receipt:""}</p>}
 {status==="REFUNDED"&&<p className="notice">An administrator has recorded a manual reversal of your payment. View your payments for the reversal reference. Your application history is retained.</p>}
 {terminal?<p className="notice success">{applicationStatus==="WITHDRAWN"?"Your application was withdrawn. Withdrawal does not automatically refund the fee.":"Your application fee is confirmed. See responses below for recruitment updates."}</p>:status==="SUCCEEDED"?<p className="notice error">Payment received, but this application needs administrator review before it can proceed. Do not pay again. Contact support with your application reference: {applicationId}.</p>:status==="NEEDS_REVIEW"?<p className="notice">Your payment is awaiting verification. Do not send another payment. Check again shortly or contact support with reference {applicationId}.</p>:<p className="hint">Save your draft first. Complete your profile and attach a CV that has passed security screening. A payment prompt freezes the saved application details until payment is resolved.</p>}
 {reviewReason==="AWAITING_RECEIPT_EVIDENCE"&&<p className="hint">We are waiting for the payment receipt details from M-Pesa.</p>}
 {!terminal&&!blocked&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();const values=new FormData(e.currentTarget);setBusy(true);setMessage("");key.current??=crypto.randomUUID();try{
 const result=await postJson("/api/applications/"+applicationId+"/payments",{configurationId:values.get("configurationId"),phone:values.get("phone"),idempotencyKey:key.current,version});
 if(["FAILED","CANCELLED"].includes(result.paymentOrder?.status))key.current=null;
 setMessage(["FAILED","CANCELLED"].includes(result.paymentOrder?.status)?"The payment request did not complete. Check the status before trying again.":"Payment request recorded. Check your phone, then check payment status.");router.refresh();
 }catch(e){setMessage((e as Error).message);router.refresh();}finally{setBusy(false);}}}>
 <label>Pay using<select name="configurationId" required>{options.map(o=><option key={o.id} value={o.id}>{o.label} · {o.kind==="TILL"?"Till "+o.tillNumber:"Paybill "+o.businessShortCode}{o.environment==="SANDBOX"?" (sandbox test)":""}</option>)}</select></label>
 {!options.length&&<p className="notice">Payments are not available yet. Your draft is saved.</p>}
 <label>M-Pesa mobile number<input name="phone" type="tel" pattern="\\+?254[17][0-9]{8}" required placeholder="+254712345678" defaultValue={phone} autoComplete="tel" /></label>
 <label className="flex items-start gap-3"><input type="checkbox" required /><span>I agree to pay {formatFee(amountMinor)} for this application. Payment does not guarantee employment.</span></label>
 <button className="button" disabled={busy||!options.length}>{busy?"Requesting...":"Pay and submit application"}</button></form>}
 {status&&!terminal&&status!=="SUCCEEDED"&&<button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await postJson("/api/applications/"+applicationId+"/payments/refresh",{});setMessage("Payment status checked. If it is still pending, wait at least 30 seconds before checking again.");key.current=null;router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Check payment status</button>}
 <p role="status">{message}</p></section>;
}

