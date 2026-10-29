"use client";
import { useState } from "react";
import { postJson } from "./auth-form";
export function SignOut() {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return <div><button className="button secondary" disabled={busy} onClick={async () => {
    setBusy(true); setError(false);
    try { await postJson("/api/auth/sign-out", {}); window.location.assign("/sign-in"); }
    catch { setError(true); setBusy(false); }
  }}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="hint">Sign out failed. Please try again.</p>}</div>;
}
