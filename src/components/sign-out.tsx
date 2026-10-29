"use client";
import { useState } from "react";
import { postJson } from "./auth-form";

export function SignOut() {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return <div><button type="button" className="button secondary" aria-label="Sign out" disabled={busy} onClick={async () => {
    setBusy(true); setError(false);
    try { await postJson("/api/auth/sign-out", {}); window.location.assign("/sign-in"); }
    catch { setError(true); setBusy(false); }
  }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h13" /></svg>
    <span className="workspace-sign-out-label">{busy ? "Signing out…" : "Sign out"}</span>
  </button>{error && <p role="alert" className="hint">Sign out failed. Please try again.</p>}</div>;
}
