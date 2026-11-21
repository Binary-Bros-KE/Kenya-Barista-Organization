"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { RecruiterRequestList } from "@/server/recruiter-requests";
import { SignatureButton } from "./signature-button";
import { Avatar, Icon, date, dateTime, number, relative } from "./admin-list-kit";

type Request = RecruiterRequestList["requests"][number];
type Status = RecruiterRequestList["query"]["status"];
const statusText: Record<string, { label: string; tone: string }> = { PENDING: { label: "Pending", tone: "is-warn" }, APPROVED: { label: "Approved", tone: "is-good" }, REJECTED: { label: "Rejected", tone: "is-danger" }, WITHDRAWN: { label: "Withdrawn", tone: "is-plain" } };

// Switches between the recruiter list and the queue of people asking to become recruiters.
export function RecruiterTabs({ current, pending }: { current: "recruiters" | "requests"; pending: number }) {
  return <nav className="recruiter-tabs" aria-label="Recruiter views">
    <Link href="/admin" aria-current={current === "recruiters" ? "page" : undefined} className={current === "recruiters" ? "is-on" : ""}><Icon name="users" size={16} />Recruiters</Link>
    <Link href="/admin?view=requests" aria-current={current === "requests" ? "page" : undefined} className={current === "requests" ? "is-on" : ""}><Icon name="clock" size={16} />Requests{pending > 0 && <span className="recruiter-tabs-count" aria-label={`${pending} pending`}>{pending}</span>}</Link>
  </nav>;
}

async function send(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That did not work. Please try again.");
  return data;
}

export function AdminRecruiterRequests({ data }: { data: RecruiterRequestList }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(data.query.q);
  const [open, setOpen] = useState<Request | null>(null);
  const [notice, setNotice] = useState("");
  const { query, pagination } = data;

  function update(changes: { q?: string; status?: Status; page?: number }) {
    const next = new URLSearchParams(params.toString());
    next.set("view", "requests");
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "" || (key === "status" && value === "PENDING") || (key === "page" && value === 1)) next.delete(key); else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next}`, { scroll: false }));
  }
  useEffect(() => {
    if (search.trim() === query.q) return;
    const timer = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const first = pagination.matching ? (pagination.page - 1) * 25 + 1 : 0, last = Math.min(pagination.page * 25, pagination.matching);
  return <div className="accounts recruiters overview">
    <RecruiterTabs current="requests" pending={data.pending} />
    {notice && <p className="recruiters-notice" role="status">{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice("")}><Icon name="close" size={14} /></button></p>}

    <section className="accounts-panel" aria-label="Recruiter requests">
      <div className="accounts-toolbar">
        <label className="accounts-search"><Icon name="search" /><span className="accounts-sr">Search requests</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, email, who they hire for or location" maxLength={100} />{search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); update({ q: "" }); }}><Icon name="close" size={15} /></button>}</label>
        <div className="accounts-chips" role="group" aria-label="Request status">{([["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["ALL", "All"]] as const).map(([status, label]) => <button type="button" key={status} aria-pressed={query.status === status} className={query.status === status ? "is-on" : ""} onClick={() => update({ status })}>{label}{status === "PENDING" && data.pending > 0 ? ` (${data.pending})` : ""}</button>)}</div>
      </div>
      <div className="accounts-summary"><p aria-live="polite">{pagination.matching ? <>Showing <strong>{first}–{last}</strong> of <strong>{number(pagination.matching)}</strong></> : "No requests to show"}{pending && <span className="accounts-loading"> · Updating…</span>}</p></div>
      {data.requests.length ? <div className={`accounts-list${pending ? " is-pending" : ""}`} role="table" aria-label="Requests">
        <div className="accounts-row requests-row accounts-head" role="row"><span role="columnheader">Person</span><span role="columnheader">Hiring for</span><span role="columnheader">Contact</span><span role="columnheader">Status</span><span role="columnheader">Sent</span><span aria-hidden="true" /></div>
        {data.requests.map(request => <button type="button" key={request.id} className="accounts-row requests-row" role="row" onClick={() => setOpen(request)} aria-label={`Review ${request.user.name || request.user.email}`}>
          <span role="cell" className="accounts-member"><Avatar name={request.user.name} email={request.user.email} /><span><strong>{request.user.name || "No name yet"}</strong><span>{request.user.email}</span></span></span>
          <span role="cell" className="requests-hiring"><strong>{request.hiringFor}</strong><span>{request.roles}</span></span>
          <span role="cell" className="requests-hiring"><strong>{request.phone}</strong><span>{request.location}</span></span>
          <span role="cell" className="accounts-badges"><em className={statusText[request.status].tone}>{statusText[request.status].label}</em></span>
          <span role="cell" className="accounts-joined">{relative(request.createdAt)}</span>
          <span className="accounts-chevron" aria-hidden="true"><Icon name="chevron" /></span>
        </button>)}
      </div> : <div className="accounts-empty"><span><Icon name="check" size={26} /></span><h3>{query.status === "PENDING" ? "All caught up" : "Nothing here"}</h3><p>{query.status === "PENDING" ? "New recruiter requests will appear here." : "Try another status or clear the search."}</p></div>}
      {pagination.pageCount > 1 && <nav className="accounts-pages" aria-label="Pages">
        <button type="button" disabled={pagination.page <= 1} onClick={() => update({ page: pagination.page - 1 })}>Previous</button>
        <span>Page {pagination.page} of {pagination.pageCount}</span>
        <button type="button" disabled={pagination.page >= pagination.pageCount} onClick={() => update({ page: pagination.page + 1 })}>Next</button>
      </nav>}
    </section>
    {open && <ReviewModal request={open} onClose={() => setOpen(null)} onDone={message => { setNotice(message); startTransition(() => router.refresh()); }} />}
  </div>;
}

function ReviewModal({ request, onClose, onDone }: { request: Request; onClose: () => void; onDone: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const name = request.user.name || request.user.email;
  async function decide(decision: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      await send(`/api/admin/recruiter-requests/${request.id}`, decision === "approve" ? { decision } : { decision, note });
      onDone(decision === "approve" ? `${name} is now a recruiter. Verify them once you've checked their details.` : `${name}'s request was rejected and they've been told why.`);
      dialog.current?.close();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "That did not work."); }
    finally { setBusy(false); }
  }
  const website = request.website ? (/^https?:/.test(request.website) ? request.website : `https://${request.website}`) : null;
  return <dialog ref={dialog} className="accounts-modal" aria-labelledby="request-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="accounts-modal-panel">
      <header className="accounts-modal-head requests-modal-head"><Avatar name={request.user.name} email={request.user.email} large /><div><h2 id="request-title">{name}</h2><p>{request.user.email}</p><div className="accounts-badges"><em className={statusText[request.status].tone}>{statusText[request.status].label}</em><em className="is-plain">Asked {relative(request.createdAt)}</em></div></div><button type="button" className="accounts-modal-close" aria-label="Close" onClick={() => dialog.current?.close()}><Icon name="close" /></button></header>
      <div className="accounts-modal-body">
        <div className="accounts-facts">
          <Fact label="Member since" value={date(request.user.createdAt)} sub={request.user.emailVerified ? "Email confirmed" : "Email not confirmed"} />
          <Fact label="Last sign-in" value={relative(request.user.lastSignInAt)} sub={dateTime(request.user.lastSignInAt)} />
          <Fact label="Applications" value={String(request.user._count.applications)} sub="As a job seeker" />
          <Fact label="Account" value={request.user.status === "ACTIVE" ? "Active" : "Suspended"} sub={request.user.role === "RECRUITER" ? "Already a recruiter" : "Job seeker"} />
        </div>
        <div className="accounts-modal-grid">
          <div>
            <Section title="Who they're hiring for"><p className="requests-big">{request.hiringFor}</p></Section>
            <Section title="Roles they plan to fill"><p className="requests-text">{request.roles}</p></Section>
            {request.message && <Section title="Their message"><p className="requests-text">“{request.message}”</p></Section>}
          </div>
          <div>
            <Section title="Contact details"><dl className="accounts-dl">
              <div><dt><Icon name="phone" size={15} />Phone</dt><dd><a href={`tel:${request.phone}`}>{request.phone}</a></dd></div>
              <div><dt><Icon name="pin" size={15} />Location</dt><dd>{request.location}</dd></div>
              <div className="is-wide"><dt><Icon name="mail" size={15} />Email</dt><dd><a href={`mailto:${request.user.email}`}>{request.user.email}</a></dd></div>
              {website && <div className="is-wide"><dt><Icon name="external" size={15} />Website or social</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{request.website}</a></dd></div>}
            </dl></Section>
            {request.status !== "PENDING" && <Section title="Decision"><p className="requests-text">{statusText[request.status].label}{request.reviewedAt ? ` ${date(request.reviewedAt)}` : ""}{request.reviewedBy ? ` by ${request.reviewedBy.name || request.reviewedBy.email}` : ""}.{request.reviewNote ? ` “${request.reviewNote}”` : ""}</p></Section>}
            <Section title="Account"><p className="recruiters-help"><Link className="recruiters-review" href={`/admin/accounts?q=${encodeURIComponent(request.user.email)}`}>Open in Accounts →</Link> for their profile and CVs.</p></Section>
          </div>
        </div>
        {mode === "reject" && <div className="requests-reject"><label>Why are you rejecting this request? <span>They'll see this, so they can apply again with the right details.</span><textarea value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={1000} autoFocus placeholder="e.g. We couldn't reach you on the phone number given. Please check it and apply again." /></label></div>}
      </div>
      {request.status === "PENDING" && <footer className="accounts-modal-foot">
        {error && <p role="alert" className="is-bad">{error}</p>}
        {mode === "view" ? <><button type="button" className="accounts-ghost" onClick={() => setMode("reject")}>Reject</button><SignatureButton tone="green" icon={<Icon name="check" size={15} />} disabled={busy} onClick={() => void decide("approve")}>{busy ? "Approving…" : "Approve as recruiter"}</SignatureButton></>
          : <><button type="button" className="accounts-ghost" onClick={() => { setMode("view"); setError(""); }}>Back</button><SignatureButton tone="rose" icon={<Icon name="ban" size={15} />} disabled={busy || note.trim().length < 5} onClick={() => void decide("reject")}>{busy ? "Rejecting…" : "Reject request"}</SignatureButton></>}
      </footer>}
    </div>
  </dialog>;
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="accounts-fact"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="accounts-section"><h3>{title}</h3>{children}</section>;
}
