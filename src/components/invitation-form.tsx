"use client";
import { useState } from "react";
import Link from "next/link";
import { postJson } from "./auth-form";
export function InvitationForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="form-stack"><p>Sign in with the verified email address that received this invitation, then accept access below.</p><p className="hint">If you need to sign in or register first, reopen your invitation email afterwards.</p><div className="flex gap-5"><Link href="/sign-in">Sign in</Link><Link href="/register">Create account</Link></div>{error && <p role="alert" className="notice error">{error}</p>}<button className="button" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      await postJson("/api/invitations/accept", { token });
      window.history.replaceState(null, "", "/invitations/accept");
      window.location.assign("/employer");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to accept invitation"); setBusy(false); }
  }}>{busy ? "Accepting…" : "Accept employer invitation"}</button></div>;
}
