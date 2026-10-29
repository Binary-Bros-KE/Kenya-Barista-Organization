"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";

export function ManualReversal({ orderId, attemptId }: { orderId: string; attemptId: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const router = useRouter();
  return <form className="admin-manual-reversal" onSubmit={async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setMessage(""); setFailed(false);
    try {
      await postJson(`/api/admin/payments/${orderId}/reverse`, {
        attemptId, reference: fields.get("reference"), note: fields.get("note"), confirmedReturnedToPayer: fields.get("confirmed") === "on",
      });
      setMessage("Payment marked reversed. The reversal has been recorded in the audit trail."); router.refresh();
    } catch (error) { setFailed(true); setMessage((error as Error).message); } finally { setBusy(false); }
  }}>
    <span className="admin-eyebrow">COMPLETED OFFLINE</span><h4>Record a manual reversal</h4>
    <p className="hint">Return the full payment to the original payer outside this site, then record the completed reversal here.</p>
    <label>Reversal reference<input name="reference" required minLength={5} maxLength={100} disabled={busy} /></label>
    <label>Private administration note<textarea name="note" required minLength={10} maxLength={2000} disabled={busy} /></label>
    <label className="flex gap-2"><input type="checkbox" name="confirmed" required disabled={busy} />I confirm the full amount has already been returned to the original payer.</label>
    <button className="button secondary" disabled={busy}>{busy ? "Recording…" : "Mark payment reversed"}</button>
    <p role={failed?"alert":"status"} className={message?"admin-feedback "+(failed?"is-error":"is-success"):""}>{message}</p>
  </form>;
}
