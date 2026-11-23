"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

// The public "Partner with us" form. Labels match partnershipKinds in src/server/partner-requests.ts.
const kinds: [string, string][] = [["SPONSORSHIP", "Sponsorship or events"], ["TRAINING", "Training and education"], ["SUPPLIER", "Supplying coffee, milk or equipment"],
  ["HIRING", "Hiring baristas"], ["MEDIA", "Media and community"], ["OTHER", "Something else"]];

export function PartnerForm() {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState(""), [fields, setFields] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setFields({});
    try {
      const response = await fetch("/api/partner-requests", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setFields(data.fields ?? {}); throw new Error(data.message || "We couldn't send your request. Please try again."); }
      setSent(true);
    } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  }
  if (sent) return <div className="content-enquiry partner-form-done" role="status"><span className="partner-form-check" aria-hidden="true">&#10003;</span><h2>Thank you, we&apos;ve got your request</h2>
    <p>Our team will read it and get back to you by email, usually within a few working days.</p><Link href="/" className="site-button">Back to the home page <span aria-hidden="true">&#8594;</span></Link></div>;
  const field = (name: string) => fields[name] ? { "aria-invalid": true, "aria-describedby": `partner-${name}-error` } : {};
  const hint = (name: string) => fields[name] ? <em id={`partner-${name}-error`} className="partner-form-error">{fields[name]}</em> : null;
  return <form className="content-enquiry partner-form" onSubmit={event => void submit(event)}>
    <div className="content-form-heading"><span className="site-eyebrow">PARTNER WITH US</span><h2>Tell us about your organisation</h2><p>A few details are all we need. We&apos;ll be in touch to talk about how we can work together.</p></div>
    <div className="content-field-row"><label>Organisation<input name="organisation" required minLength={2} maxLength={160} autoComplete="organization" {...field("organisation")}/>{hint("organisation")}</label>
      <label>Your name<input name="contactName" required minLength={2} maxLength={120} autoComplete="name" {...field("contactName")}/>{hint("contactName")}</label></div>
    <div className="content-field-row"><label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" {...field("email")}/>{hint("email")}</label>
      <label>Phone number <span>Optional</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" {...field("phone")}/>{hint("phone")}</label></div>
    <div className="content-field-row"><label>Website or social media <span>Optional</span><input name="website" maxLength={200} placeholder="e.g. instagram.com/yourcafe" autoComplete="url" {...field("website")}/>{hint("website")}</label>
      <label>What would you like to partner on?<select name="kind" required defaultValue="" {...field("kind")}><option value="" disabled>Choose one</option>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{hint("kind")}</label></div>
    <label>Your message<textarea name="message" required minLength={20} maxLength={2000} rows={6} placeholder="What do you have in mind? Tell us about your organisation and the kind of partnership you're interested in." {...field("message")}/>{hint("message")}</label>
    <label className="partner-form-trap" aria-hidden="true">Leave this empty<input name="nickname" tabIndex={-1} autoComplete="off"/></label>
    <button className="site-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send partnership request"} <span aria-hidden="true">&#8599;</span></button>
    {error && <p role="alert" className="content-feedback is-error">{error}</p>}
  </form>;
}
