"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export type SafeMpesaConfig={id:string;label:string;kind:"PAYBILL"|"TILL";environment:"SANDBOX"|"LIVE";businessShortCode:string;tillNumber:string|null;enabled:boolean};
export function MpesaSettingsForm({configurations}:{configurations:SafeMpesaConfig[]}){
 const [kind,setKind]=useState<"PAYBILL"|"TILL">("PAYBILL"),[environment,setEnvironment]=useState<"SANDBOX"|"LIVE">("SANDBOX");
 const current=configurations.find(c=>c.kind===kind&&c.environment===environment);const router=useRouter();
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 return <div className="card form-stack"><h2>Payment configuration</h2><p className="hint">Select Paybill or Till. Each save keeps the previous credential revision for payments already in progress. Only one revision per payment type can be enabled.</p>
 <label>Collection type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="PAYBILL">Paybill</option><option value="TILL">Buy Goods / Till</option></select></label>
 <label>Environment<select value={environment} onChange={e=>setEnvironment(e.target.value as typeof environment)}><option value="SANDBOX">Sandbox testing</option><option value="LIVE">Live payments</option></select></label>
 <form key={kind+environment+(current?.id||"new")} className="form-stack" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,values=new FormData(form);setBusy(true);setMessage("");try{
 const consumerKey=String(values.get("consumerKey")||""),consumerSecret=String(values.get("consumerSecret")||""),passkey=String(values.get("passkey")||"");
 const credentials=consumerKey||consumerSecret||passkey?{consumerKey,consumerSecret,passkey}:undefined;
 await postJson("/api/admin/payments/settings",{kind,environment,label:values.get("label"),businessShortCode:values.get("businessShortCode"),tillNumber:kind==="TILL"?values.get("tillNumber"):null,enabled:values.get("enabled")==="on",...(credentials?{credentials}:{})});
 form.reset();setMessage("Payment configuration saved. Secrets are stored encrypted.");router.refresh();
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
 <label>Checkout label<input name="label" required minLength={2} maxLength={80} defaultValue={current?.label||("KBO "+(kind==="TILL"?"Till":"Paybill"))} /></label>
 <label>{kind==="TILL"?"Business shortcode (onboarded HO / store number)":"Paybill business shortcode"}<input name="businessShortCode" inputMode="numeric" pattern="[0-9]{4,10}" required defaultValue={current?.businessShortCode||""} /></label>
 {kind==="TILL"&&<label>Customer-facing Till number<input name="tillNumber" inputMode="numeric" pattern="[0-9]{4,10}" required defaultValue={current?.tillNumber||""} /><span className="hint">Sent as PartyB. This is separate from the shortcode used to generate the STK password.</span></label>}
 <p className="hint">{current?"Credentials are saved. Leave all three fields empty to retain them, or provide all three to replace them.":"Enter the Daraja app credentials and STK passkey supplied for this environment."}</p>
 <label>Consumer key<input name="consumerKey" type="password" autoComplete="new-password" required={!current} minLength={8} maxLength={512} /></label>
 <label>Consumer secret<input name="consumerSecret" type="password" autoComplete="new-password" required={!current} minLength={8} maxLength={512} /></label>
 <label>STK passkey<input name="passkey" type="password" autoComplete="new-password" required={!current} minLength={8} maxLength={512} /></label>
 <label className="flex items-center gap-3"><input name="enabled" type="checkbox" defaultChecked={current?.enabled||false} />Enable this option at checkout</label>
 <p className="hint">Sandbox options are hidden in production. Live credentials can charge real money. Confirm the merchant and environment before enabling.</p>
 <button className="button" disabled={busy}>{busy?"Saving...":"Save payment settings"}</button><p role="status">{message}</p></form>
 <h3>Enabled options</h3>{configurations.filter(c=>c.enabled).map(c=><p key={c.id}>{c.label} · {c.kind} · {c.environment} · {c.kind==="TILL"?c.tillNumber:c.businessShortCode}</p>)}
 </div>;
}

