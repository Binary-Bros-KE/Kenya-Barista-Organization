"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SignatureButton } from "./signature-button";

type Request = { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"; hiringFor: string; roles: string; phone: string; location: string; website: string | null; message: string; reviewNote: string | null; reviewedAt: Date | string | null; createdAt: Date | string };
const day = (value: Date | string) => new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "long" }).format(new Date(value));
const Check = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
const statusLabel: Record<Request["status"], string> = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Not approved", WITHDRAWN: "Withdrawn" };
const ordinal = (n: number) => ["first", "second", "third"][n - 1] ?? `${n}th`;
const Briefcase = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V3h8v4M3 12a20 20 0 0 0 18 0" /></svg>;
const Trash = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>;

// A job seeker's request to become a recruiter: the form, its status, and every earlier request.
export function RecruiterRequest({ request, earlier = [], used = request ? 1 : 0, limit = 3, remaining = Math.max(0, limit - used), isRecruiter = false, phone, location }: { request: Request | null; earlier?: Request[]; used?: number; limit?: number; remaining?: number; isRecruiter?: boolean; phone: string; location: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState((!request || request.status === "WITHDRAWN") && remaining > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rejected = request?.status === "REJECTED";
  // Approved, but an administrator has since changed the account back to a job seeker.
  const removed = request?.status === "APPROVED" && !isRecruiter;
  const canReapply = rejected || removed;
  const outOfRequests = remaining === 0 && request?.status !== "PENDING" && !isRecruiter;
  const all = request ? [request, ...earlier] : [];
  const attempts = remaining > 0 && !isRecruiter ? <span className="recruit-attempts">{remaining} {remaining === 1 ? "attempt" : "attempts"} remaining</span> : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/recruiter-request", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, website: fields.website || undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your request could not be sent. Check the details and try again.");
      setEditing(false); router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Your request could not be sent."); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/recruiter-request", { method: "DELETE", credentials: "same-origin" }); if (!response.ok) throw new Error(); router.refresh(); }
    catch { setError("Your request could not be withdrawn. Try again."); }
    finally { setBusy(false); }
  }

  const steps = [["Tell us about your hiring", "Who you hire for and the roles"], ["KBO reviews your request", "Usually within two working days"], ["Start posting jobs", "Then get verified for a badge on your jobs"]];
  return <div className="recruit-request">
    <section className="recruit-hero"><div><span className="recruit-eyebrow">FOR CAFÉS, ROASTERS AND HOSPITALITY TEAMS</span><h2>Hire skilled baristas through KBO.</h2><p>Recruiter accounts post jobs, review applicants and reply to them, all from this dashboard. You keep your job-seeker profile too.</p></div>
      <ol>{steps.map(([title, hint], index) => <li key={title}><span>{index + 1}</span><strong>{title}</strong><small>{hint}</small></li>)}</ol></section>

    {request?.status === "PENDING" && !editing && <section className="recruit-status is-pending" aria-live="polite"><div className="recruit-status-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div>
      <div><h3>Your request is with KBO</h3><p>Sent {day(request.createdAt)}. We may call {request.phone} to confirm your details. You'll get a notification when it's reviewed.</p>
        <dl><div><dt>Hiring for</dt><dd>{request.hiringFor}</dd></div><div><dt>Roles</dt><dd>{request.roles}</dd></div></dl>
        <SignatureButton tone="rose" icon={<Trash />} disabled={busy} onClick={() => void withdraw()}>{busy ? "Withdrawing…" : "Withdraw request"}</SignatureButton></div></section>}

    {request?.status === "APPROVED" && isRecruiter && <section className="recruit-status is-approved"><div className="recruit-status-icon"><Check /></div><div><h3>You're a recruiter</h3><p>Your request was approved {request.reviewedAt ? day(request.reviewedAt) : ""}. Post your first job to start receiving applicants.</p><SignatureButton tone="teal" icon={<Briefcase />} href="/employer/jobs/new">Post a job</SignatureButton></div></section>}

    {rejected && !editing && <section className="recruit-status is-rejected"><div className="recruit-status-icon">!</div><div><h3>Your last request wasn't approved</h3><p>{request.reviewNote ? <>KBO said: “{request.reviewNote}”</> : "KBO couldn't approve it this time."}</p>{remaining > 0 ? <><SignatureButton tone="teal" icon={<Briefcase />} onClick={() => setEditing(true)}>Apply again</SignatureButton></> : null}</div></section>}

    {removed && !editing && <section className="recruit-status is-rejected"><div className="recruit-status-icon">!</div><div><h3>Your recruiter access was removed</h3><p>KBO changed your account back to a job seeker. Your profile, CVs and applications are unchanged. If you'd like to recruit again, send a new request.</p>{remaining > 0 ? <SignatureButton tone="teal" icon={<Briefcase />} onClick={() => setEditing(true)}>Apply again</SignatureButton> : null}</div></section>}

    {outOfRequests && <section className="recruit-status is-limit" role="alert"><div className="recruit-status-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg></div><div><h3>You've used all {limit} requests</h3><p>Each account can ask to become a recruiter {limit} times. If your situation has changed, <Link href="/contact">contact KBO</Link> and we'll take a look.</p></div></section>}

    {editing && <form className="recruit-form" onSubmit={event => void submit(event)}>
      <div className="recruit-form-head"><h3>{canReapply ? "Apply again" : "Ask to become a recruiter"}</h3>{all.length === 0 && attempts}</div>
      <p className="recruit-form-intro">KBO reads every request. Clear details help us approve you faster. This will be your {ordinal(used + 1)} of {limit} requests.</p>
      <label className="is-wide">Who are you hiring for?<input name="hiringFor" required minLength={2} maxLength={160} defaultValue={request?.hiringFor ?? ""} placeholder="e.g. Java House, Westlands branch, or my own café" disabled={busy} /><span>Your jobs show your account name as the employer, so name your account after your business if you like.</span></label>
      <label className="is-wide">Which roles do you plan to fill?<input name="roles" required minLength={2} maxLength={300} defaultValue={request?.roles ?? ""} placeholder="e.g. Baristas, a head barista, café supervisor" disabled={busy} /></label>
      <label>Phone number<input name="phone" required pattern="\+254[17][0-9]{8}" defaultValue={request?.phone ?? phone} placeholder="+2547XXXXXXXX" disabled={busy} /><span>KBO may call to confirm your details.</span></label>
      <label>Location<input name="location" required minLength={2} maxLength={120} defaultValue={request?.location ?? location} placeholder="e.g. Nairobi, Westlands" disabled={busy} /></label>
      <label className="is-wide"><span className="recruit-label">Website or social page <em>(optional)</em></span><input name="website" maxLength={200} defaultValue={request?.website ?? ""} placeholder="e.g. instagram.com/yourcafe" disabled={busy} /><span>Helps us verify you quickly.</span></label>
      <label className="is-wide"><span className="recruit-label">Anything else? <em>(optional)</em></span><textarea name="message" maxLength={1000} rows={3} defaultValue={request?.message ?? ""} placeholder="e.g. We're opening a second branch in January and need four baristas." disabled={busy} /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="recruit-actions">{canReapply && <button type="button" className="recruit-link" onClick={() => setEditing(false)}>Cancel</button>}<SignatureButton tone="teal" type="submit" icon={<Briefcase />} disabled={busy}>{busy ? "Sending…" : "Send request"}</SignatureButton></div>
    </form>}

    {all.length > 0 && <section className="recruit-history" aria-labelledby="recruit-history-title">
      <div className="recruit-history-title"><h3 id="recruit-history-title">Your requests</h3>{attempts}</div>
      <ol>{all.map((item, index) => { const reverted = item.status === "APPROVED" && !(isRecruiter && index === 0); return <li key={item.id} className={reverted ? "is-reverted" : `is-${item.status.toLowerCase()}`}>
        <div className="recruit-history-head"><strong>{item.hiringFor}{index === 0 && <span className="recruit-latest">Latest</span>}</strong><span className="recruit-pill">{reverted ? "Reverted" : statusLabel[item.status]}</span></div>
        <p>Sent {day(item.createdAt)}{item.reviewedAt ? ` · reviewed ${day(item.reviewedAt)}` : ""} · {item.roles}</p>
        {item.status === "REJECTED" && item.reviewNote && <p className="recruit-history-reason">KBO said: “{item.reviewNote}”</p>}
      </li>; })}</ol>
    </section>}

    <p className="recruit-foot">Questions first? <Link href="/contact">Contact KBO</Link>.</p>
  </div>;
}
