"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDeadline } from "@/lib/job-format";

// Partner requests from the public "Partner with us" form, newest first, filed as New, Contacted or Archived.
// The notification email set here is where KBO is emailed about each new request.
type Status = "NEW" | "CONTACTED" | "ARCHIVED";
type Request = { id: string; organisation: string; contactName: string; email: string; phone: string | null; website: string | null; kindLabel: string; message: string;
  status: Status; notifiedAt: string | null; handledAt: string | null; createdAt: string; handledBy: { name: string | null; email: string } | null };
type Data = { status: Status; requests: Request[]; counts: Record<Status, number>; notificationEmail: string | null; pagination: { page: number; total: number; pageCount: number } };

const tabs: [Status, string][] = [["NEW", "New"], ["CONTACTED", "Contacted"], ["ARCHIVED", "Archived"]];
const moves: Record<Status, [Status, string][]> = { NEW: [["CONTACTED", "✓ Mark contacted"], ["ARCHIVED", "Archive"]], CONTACTED: [["ARCHIVED", "Archive"], ["NEW", "Move back to new"]], ARCHIVED: [["NEW", "Restore to new"]] };
const ago = (value: string) => { const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000); return minutes < 60 ? `${Math.max(1, minutes)} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`; };
const link = (website: string) => /^https?:\/\//i.test(website) ? website : `https://${website}`;
async function send(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That didn't work. Please try again.");
  return data;
}

export function AdminPartners() {
  const [status, setStatus] = useState<Status>("NEW"), [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { setData(await send(`/api/admin/partner-requests?status=${status}&page=${page}`)); setError(""); } catch (problem) { setError((problem as Error).message); }
  }, [status, page]);
  useEffect(() => { void load(); }, [load]);

  return <div className="preq">
    <div className="preq-bar">
      <div className="preq-tabs" role="tablist" aria-label="Partner requests by status">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={status === value} className={"is-" + value.toLowerCase() + (status === value ? " is-on" : "")} onClick={() => { setStatus(value); setPage(1); }}>{label}<span>{data?.counts[value] ?? "…"}</span></button>)}</div>
      {data && <EmailWidget email={data.notificationEmail} onSaved={message => { setNotice(message); void load(); }} />}
    </div>
    {data && !data.notificationEmail && <p className="preq-hint">No notification email is set, so new requests are emailed to every administrator. Set one above to send them to a single inbox.</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {error && <p className="notice error" role="alert">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
    {!data ? <div className="employer-loading" role="status"><span aria-hidden="true" />Loading partner requests…</div>
      : !data.requests.length ? <div className="preq-empty"><strong>{status === "NEW" ? "No new requests" : "Nothing here yet"}</strong><span>{status === "NEW" ? "When an organisation fills in the Partner with us form, it appears here and KBO is emailed." : "Requests you move here will be listed."}</span></div>
      : <ul className="preq-list">{data.requests.map(request => <RequestCard key={request.id} request={request} onDone={message => { setNotice(message); void load(); }} />)}</ul>}
    {data && data.pagination.pageCount > 1 && <nav className="djobs-pages" aria-label="Partner request pages"><span>Page {page} of {data.pagination.pageCount}</span><div>{page > 1 && <button type="button" className="underline" onClick={() => setPage(page - 1)}>&larr; Previous</button>}{page < data.pagination.pageCount && <button type="button" className="underline" onClick={() => setPage(page + 1)}>Next &rarr;</button>}</div></nav>}
  </div>;
}

function RequestCard({ request, onDone }: { request: Request; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function move(status: Status) {
    setBusy(true); setError("");
    try { await send(`/api/admin/partner-requests/${request.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); onDone(`${request.organisation} moved to ${tabs.find(([value]) => value === status)![1].toLowerCase()}.`); }
    catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  }
  const initials = request.organisation.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <li className={"preq-card is-" + request.status.toLowerCase()}>
    <header className="preq-card-head"><span className="preq-mark" aria-hidden="true">{initials}</span>
      <div><strong>{request.organisation}</strong><span>{request.contactName} · {ago(request.createdAt)}</span></div>
      <em className="preq-kind">{request.kindLabel}</em></header>
    <div className="preq-contact">
      <a href={`mailto:${request.email}?subject=${encodeURIComponent("Partnering with Kenya Barista Organization")}`}>✉ {request.email}</a>
      {request.phone && <a href={`tel:${request.phone.replace(/[^\d+]/g, "")}`}>☎ {request.phone}</a>}
      {request.website && <a href={link(request.website)} target="_blank" rel="noopener noreferrer nofollow">↗ {request.website}</a>}
    </div>
    <p className="preq-message">{request.message}</p>
    <footer className="preq-card-foot">
      <span>Received {formatDeadline(request.createdAt)}{request.handledBy && request.handledAt ? ` · last updated by ${request.handledBy.name || request.handledBy.email}` : ""}{!request.notifiedAt && " · email not sent"}</span>
      <div>{moves[request.status].map(([next, label]) => <button key={next} type="button" className={next === "CONTACTED" ? "preq-primary" : "preq-secondary"} disabled={busy} onClick={() => void move(next)}>{label}</button>)}</div>
    </footer>
    {error && <p className="notice error" role="alert">{error}</p>}
  </li>;
}

// Where new partner requests are emailed, in one line.
function EmailWidget({ email, onSaved }: { email: string | null; onSaved: (message: string) => void }) {
  const [value, setValue] = useState(email ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const changed = value.trim().toLowerCase() !== (email ?? "");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const saved = await send("/api/admin/partner-requests/settings", { method: "PUT", body: JSON.stringify({ email: value.trim() }) });
      onSaved(saved.email ? `Partner requests will be emailed to ${saved.email}.` : "Notification email cleared. Requests will go to every administrator."); }
    catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  }
  return <form className="preq-email" onSubmit={event => void save(event)} title="New partner requests are emailed to this address">
    <span aria-hidden="true">✉ ALERTS</span>
    <input type="email" value={value} onChange={event => setValue(event.target.value)} placeholder="Notification email" aria-label="Email address for partner request alerts" />
    <button disabled={busy || !changed}>{busy ? "Saving…" : "Save"}</button>
    {error && <em role="alert">{error}</em>}
  </form>;
}
