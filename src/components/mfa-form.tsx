"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "./auth-form";

export function MfaForm({ enabled, verified }: { enabled: boolean; verified: boolean }) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = await postJson("/api/auth/two-factor/enable", { password: String(new FormData(event.currentTarget).get("password")), method: "totp" }); setEnrolment(data); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to start setup"); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await postJson("/api/auth/two-factor/verify-totp", { code: String(new FormData(event.currentTarget).get("code")).trim(), trustDevice: false });
      setEnrolment(null); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to verify code"); }
    finally { setBusy(false); }
  }
  return <div className="form-stack max-w-xl">
    {error && <p role="alert" className="notice error">{error}</p>}
    {enabled && verified ? <p className="notice success">Two-factor authentication is enabled and verified for this session.</p> : <>
      {!enabled && !enrolment && <form onSubmit={enable} className="form-stack"><p>Add your account to an authenticator app. You will also receive recovery codes.</p><label>Confirm your password<input type="password" name="password" required autoComplete="current-password" maxLength={128} /></label><button disabled={busy} className="button">{busy ? "Please wait…" : "Set up authenticator"}</button></form>}
      {enrolment && <div className="card form-stack"><h2>Save your authenticator key</h2><p className="hint">In your authenticator app, choose to enter a setup key manually. Select a time-based account and enter this key:</p><code className="secret-text">{new URL(enrolment.totpURI).searchParams.get("secret")}</code><h3>Save these recovery codes somewhere private</h3><p className="hint">Each recovery code can be used once if you lose access to your authenticator.</p><pre className="secret-text">{enrolment.backupCodes.join("\n")}</pre><label className="check-label"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />I have saved my recovery codes</label></div>}
      {(enabled || enrolment) && <form onSubmit={verify} className="form-stack"><label>Six-digit authenticator code<input name="code" required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" /></label><button className="button" disabled={busy || Boolean(enrolment && !saved)}>{busy ? "Verifying…" : "Verify code"}</button></form>}
    </>}
  </div>;
}
