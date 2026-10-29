"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export function PaymentRecheck({orderId}:{orderId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 return <div className="mt-4"><button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await postJson(`/api/admin/payments/${orderId}/refresh`,{});setMessage("Status checked. Provider checks are limited to once per 30 seconds.");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>Recheck with Daraja</button><p role="status">{message}</p></div>;
}
