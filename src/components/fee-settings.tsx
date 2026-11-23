"use client";
import { useEffect, useState, type FormEvent } from "react";
export function FeeSettings() {
  const [value, setValue] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/settings", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setValue(data.defaultApplicationFeeMinor == null ? "" : String(data.defaultApplicationFeeMinor / 100)); }).catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationFeeKes: Number(value) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setMessage("Default fee saved. Existing job fees are unchanged."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save fee"); } finally { setBusy(false); }
  }
  // A compact control beside the status filter on Job review.
  return <form className="fee-widget" onSubmit={save} title="Default application fee: suggested to recruiters for new jobs. Existing jobs keep their fees.">
    {value && <span className="fee-widget-prefix" aria-hidden="true">KES</span>}
    <input type="number" min={1} max={250000} step={1} required value={value} onChange={event => { setValue(event.target.value); setMessage(""); setError(""); }} disabled={loading || busy} placeholder="Default fee (KES)" aria-label="Default application fee in KES" />
    <button disabled={loading || busy} className="fee-widget-save">{busy ? "Saving…" : "Save"}</button>
    {error ? <span role="alert" className="fee-widget-note is-error" title={error}>{error}</span> : message && <span role="status" className="fee-widget-note is-ok">✓ Saved</span>}
  </form>;
}
