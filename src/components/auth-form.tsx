"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "sign-in" | "register" | "forgot-password" | "reset-password" | "verify-email" | "two-factor";
const labels: Record<Mode, string> = { "sign-in": "Sign in", register: "Create account", "forgot-password": "Send reset link", "reset-password": "Save new password", "verify-email": "Resend verification email", "two-factor": "Verify and continue" };

export async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 429 ? "Too many attempts. Please wait a minute and try again." : data.message || "Unable to complete this request. Please try again.");
  return data;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [backup, setBackup] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    try {
      if (mode === "sign-in") {
        const data = await postJson("/api/auth/sign-in/email", { email, password, rememberMe: false });
        router.push(data.twoFactorRedirect ? "/two-factor" : "/dashboard"); router.refresh();
      } else if (mode === "register") {
        await postJson("/api/auth/sign-up/email", { email, password, name: String(form.get("name") || "").trim(), callbackURL: `${window.location.origin}/sign-in?verified=1` });
        router.push("/verify-email");
      } else if (mode === "forgot-password") {
        await postJson("/api/auth/request-password-reset", { email, redirectTo: `${window.location.origin}/reset-password` });
        setMessage("If an account exists for this email, a password reset link will arrive shortly.");
      } else if (mode === "verify-email") {
        await postJson("/api/auth/send-verification-email", { email, callbackURL: `${window.location.origin}/sign-in?verified=1` });
        setMessage("If verification is needed, a new link will arrive shortly.");
      } else if (mode === "reset-password") {
        const token = new URLSearchParams(window.location.search).get("token");
        if (!token) throw new Error("Open a valid password reset link from your email first.");
        await postJson("/api/auth/reset-password", { token, newPassword: password });
        window.history.replaceState(null, "", "/reset-password");
        setMessage("Password updated. You can now sign in with your new password.");
      } else {
        await postJson(`/api/auth/two-factor/${backup ? "verify-backup-code" : "verify-totp"}`, { code: String(form.get("code") || "").trim(), trustDevice: false });
        router.push("/dashboard"); router.refresh();
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to complete this request"); }
    finally { setBusy(false); }
  }
  const emailNeeded = !["reset-password", "two-factor"].includes(mode);
  const passwordNeeded = ["sign-in", "register", "reset-password"].includes(mode);
  return <form onSubmit={submit} className="form-stack">
    {mode === "register" && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>}
    {emailNeeded && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
    {passwordNeeded && <label>{mode === "reset-password" ? "New password" : "Password"}<input name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={mode === "sign-in" ? 1 : 12} maxLength={128} />{mode !== "sign-in" && <span className="hint">Use 12–128 characters. A long, unique passphrase works well.</span>}</label>}
    {mode === "two-factor" && <><label>{backup ? "Recovery code" : "Authenticator code"}<input name="code" autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} required pattern={backup ? undefined : "[0-9]{6}"} /></label><label className="check-label"><input type="checkbox" checked={backup} onChange={event => setBackup(event.target.checked)} />Use a recovery code instead</label></>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="notice success">{message}</p>}
    <button className="button" disabled={busy}>{busy ? "Please wait…" : labels[mode]}</button>
    {mode === "sign-in" && <div className="flex flex-wrap justify-between gap-3 text-sm"><Link href="/forgot-password">Forgot password?</Link><Link href="/verify-email">Verify email</Link></div>}
    {mode === "sign-in" ? <p className="hint">New here? <Link href="/register">Create an account</Link></p> : <Link href="/sign-in" className="text-sm underline">Back to sign in</Link>}
  </form>;
}
