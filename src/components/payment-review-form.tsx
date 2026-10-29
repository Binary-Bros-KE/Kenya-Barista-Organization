"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";
export function PaymentReviewForm({ orderId, version, attempts }: { orderId: string; version: number; attempts: { id: string; status: string; receiptNumber: string | null }[] }) {
  const [action, setAction] = useState("NOTE"), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  return <form className="card form-stack mt-6" onSubmit={async event => {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const input = { version, attemptId: fields.get("attemptId"), action, note: fields.get("note"),
      ...(action !== "NOTE" ? { evidenceReference: fields.get("evidenceReference"), statementChecked: fields.get("statementChecked") === "on" } : {}),
      ...(action === "CONFIRM_RECEIPT" ? { receipt: fields.get("receipt"), phone: fields.get("phone"), merchant: fields.get("merchant"), amountMinor: Math.round(Number(fields.get("amount")) * 100) } : {}) };
    try { const result = await postJson(`/api/admin/payments/${orderId}/review`, input); setMessage(result.submitted ? "Receipt confirmed and original application submitted." : "Review recorded. Check the updated payment and application status."); router.refresh(); }
    catch (error) { setMessage((error as Error).message); router.refresh(); } finally { setBusy(false); }
  }}>
    <h2>Record a review decision</h2><p className="hint">Private notes stay in administration. The applicant receives a generic update for a resolution.</p>
    <label>Payment attempt<select name="attemptId" required disabled={busy}>{attempts.map(attempt => <option key={attempt.id} value={attempt.id}>{attempt.id} - {attempt.status}{attempt.receiptNumber ? ` - ${attempt.receiptNumber}` : ""}</option>)}</select></label>
    <label>Action<select value={action} disabled={busy} onChange={event => setAction(event.target.value)}><option value="NOTE">Add private note</option><option value="CONFIRM_RECEIPT">Confirm a statement receipt</option><option value="NOT_CHARGED">Statement confirms no charge</option><option value="RETRY_SUBMISSION">Retry original paid submission</option></select></label>
    {action === "NOT_CHARGED" && <p className="notice">Only unresolved requests at least 10 minutes old without success evidence can be cleared. This permits another checkout. A missing SMS or callback is insufficient.</p>}
    {action === "RETRY_SUBMISSION" && <p className="notice">The original job terms, CV and frozen application must still be eligible. If they are not, contact the applicant and handle any return of funds manually.</p>}
    {action === "CONFIRM_RECEIPT" && <><label>Original M-Pesa receipt<input name="receipt" required minLength={10} maxLength={20} disabled={busy} /></label><label>Statement amount (KES)<input name="amount" type="number" required min={1} step="0.01" disabled={busy} /></label><label>Statement payer number<input name="phone" required placeholder="254712345678" disabled={busy} /></label><label>Receiving Paybill or Till number<input name="merchant" required inputMode="numeric" disabled={busy} /></label></>}
    {action !== "NOTE" && <><label>Statement or case reference<input name="evidenceReference" required minLength={5} maxLength={150} disabled={busy} /></label><label className="flex gap-2"><input name="statementChecked" type="checkbox" required disabled={busy} />I checked the original merchant statement and confirm this decision.</label></>}
    <label>Private review note<textarea name="note" required minLength={10} maxLength={2000} disabled={busy} /></label>
    <button className="button" disabled={busy || !attempts.length}>{busy ? "Recording..." : "Record decision"}</button><p role="status">{message}</p>
  </form>;
}
