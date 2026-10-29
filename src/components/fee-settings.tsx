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
  return <details className="card mb-8"><summary className="cursor-pointer font-semibold">Default application fee</summary><form className="form-stack mt-5 max-w-lg" onSubmit={save}><p className="hint">Set the fee inherited by new employer postings. You can override a job’s fee before applications begin.</p><label>Amount in KES<input type="number" min={1} max={250000} step={1} required value={value} onChange={event => setValue(event.target.value)} disabled={loading} /></label>{error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice success">{message}</p>}<button disabled={loading || busy} className="button">{busy ? "Saving…" : "Save default fee"}</button></form></details>;
}
