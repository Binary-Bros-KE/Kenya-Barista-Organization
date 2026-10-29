"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export function PaymentRecheck({orderId}:{orderId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);const router=useRouter();
 return <div className="mt-4 admin-payment-recheck"><button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);setMessage("");setFailed(false);try{await postJson(`/api/admin/payments/${orderId}/refresh`,{});setMessage("Status checked. Provider checks are limited to once per 30 seconds.");router.refresh();}catch(e){setFailed(true);setMessage((e as Error).message);}finally{setBusy(false);}}}>Recheck with Daraja</button><p role={failed?"alert":"status"} className={message?"admin-feedback "+(failed?"is-error":"is-success"):""}>{message}</p></div>;
}
