"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";

export function ManualReversal({ orderId, attemptId }: { orderId: string; attemptId: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  return <form className="mt-5 grid gap-3" onSubmit={async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await postJson(`/api/admin/payments/${orderId}/reverse`, {
        attemptId, reference: fields.get("reference"), note: fields.get("note"), confirmedReturnedToPayer: fields.get("confirmed") === "on",
      });
      setMessage("Payment marked reversed. The reversal has been recorded in the audit trail."); router.refresh();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }}>
    <h4>Record a manual reversal</h4>
    <p className="hint">Return the full payment to the original payer outside this site, then record the completed reversal here.</p>
    <label>Reversal reference<input name="reference" required minLength={5} maxLength={100} disabled={busy} /></label>
    <label>Private administration note<textarea name="note" required minLength={10} maxLength={2000} disabled={busy} /></label>
    <label className="flex gap-2"><input type="checkbox" name="confirmed" required disabled={busy} />I confirm the full amount has already been returned to the original payer.</label>
    <button className="button secondary" disabled={busy}>{busy ? "Recording…" : "Mark payment reversed"}</button>
    <p role="status">{message}</p>
  </form>;
}
