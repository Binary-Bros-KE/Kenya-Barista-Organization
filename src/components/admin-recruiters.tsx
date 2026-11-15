"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { RecruiterDetail, RecruiterList, RecruiterQuery } from "@/server/admin-recruiters";
import { statusLabels } from "@/lib/job-format";
import { SignatureButton } from "./signature-button";
import { Avatar, Icon, date, dateTime, freshness, number, relative, type IconName } from "./admin-list-kit";
import { VerifiedBadge } from "./verified-badge";
import { RecruiterTabs } from "./admin-recruiter-requests";

type Recruiter = RecruiterList["recruiters"][number];
const defaults: Omit<RecruiterQuery, "page"> = { q: "", status: "all", sort: "newest" };
const auditLabels: Record<string, string> = {
  "account.made_recruiter": "Made a recruiter", "recruiter_request.submitted": "Asked to become a recruiter", "recruiter_request.approved": "Recruiter request approved", "recruiter_request.rejected": "Recruiter request rejected", "recruiter.verified": "Marked as verified", "recruiter.unverified": "Verification removed", "account.made_job_seeker": "Changed to job seeker", "account.suspended": "Account suspended", "account.reactivated": "Account reactivated",
  "job.created": "Job created", "job.edited": "Job edited", "job.submit": "Job sent for review", "job.withdraw": "Job withdrawn from review", "job.publish": "Job published",
  "job.request_changes": "Changes requested", "job.close": "Job closed", "job.archive": "Job archived", "job.reopen": "Job reopened", "job.deadline_closed": "Job closed at deadline",
};
const auditText = (action: string) => auditLabels[action] ?? action.replace(/[._]/g, " ");

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, credentials: "same-origin", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That did not work. Please try again.");
  return data;
}

// Recruiter details are fetched once per visit: on hover/focus or on open, then reused.
const detailCache = new Map<string, Promise<RecruiterDetail>>();
function loadDetail(id: string, fresh = false) {
  if (fresh) detailCache.delete(id);
  let request = detailCache.get(id);
  if (!request) {
    request = send(`/api/admin/recruiters/${id}`, "GET").then(body => body.recruiter as RecruiterDetail);
    request.catch(() => detailCache.delete(id));
    detailCache.set(id, request);
  }
  return request;
}

export function AdminRecruiters({ data }: { data: RecruiterList }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(data.query.q);
  const [open, setOpen] = useState<Recruiter | null>(null);
  const [notice, setNotice] = useState("");
  const { stats, query, pagination } = data;
  useEffect(() => { detailCache.clear(); }, [data]);

  function update(changes: Partial<RecruiterQuery>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === defaults[key as keyof typeof defaults] || (key === "page" && value === 1)) next.delete(key); else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }
  const refresh = () => startTransition(() => router.refresh());
  useEffect(() => {
    if (search.trim() === query.q) return;
    const timer = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = query.q || query.status !== "all";
  const cards: { label: string; value: number; hint: string; icon: IconName; color: string; apply?: Partial<RecruiterQuery>; href?: string }[] = [
    { label: "Recruiters", value: stats.total, hint: stats.suspended ? `${number(stats.active)} active · ${number(stats.suspended)} suspended` : "All active", icon: "users", color: "teal", apply: { ...defaults } },
    { label: "Verified", value: stats.verified, hint: stats.total - stats.verified ? `${number(stats.total - stats.verified)} still to verify` : "Everyone is verified", icon: "check", color: "green", apply: { status: stats.total - stats.verified ? "unverified" : "verified" } },
    { label: "Pending requests", value: stats.pendingRequests, hint: stats.pendingRequests ? "Job seekers asking to recruit" : "No requests waiting", icon: "clock", color: "gold", href: "/admin?view=requests" },
    { label: "Applications received", value: stats.applications, hint: "Paid submissions to all recruiters", icon: "file", color: "rose", href: "/employer/applications" },
  ];
  const first = pagination.matching ? (pagination.page - 1) * 25 + 1 : 0, last = Math.min(pagination.page * 25, pagination.matching);

  return <div className="accounts recruiters overview">
    <RecruiterTabs current="recruiters" pending={stats.pendingRequests} />
    <section className="overview-stats is-compact" aria-label="Recruiter summary">{cards.map(card => {
      const inner = <><span className="overview-stat-icon"><Icon name={card.icon} /></span><span className="overview-stat-label">{card.label}</span><strong>{number(card.value)}</strong><span className="overview-stat-hint">{card.hint}<Icon name="chevron" size={14} /></span><span className="overview-stat-mark" aria-hidden="true"><Icon name={card.icon} /></span></>;
      return card.href ? <Link key={card.label} href={card.href} className={`overview-stat overview-stat-${card.color}`} aria-label={`${card.label}: ${number(card.value)}`}>{inner}</Link>
        : <button type="button" key={card.label} className={`overview-stat overview-stat-${card.color}`} onClick={() => update(card.apply!)} aria-label={`${card.label}: ${number(card.value)}`}>{inner}</button>;
    })}</section>

    <div className="accounts-insights"><Icon name="spark" size={16} /><span>At a glance:</span>
      <span className="accounts-insight"><strong>{number(stats.liveJobs)}</strong> live job{stats.liveJobs === 1 ? "" : "s"}</span>
      <Link href="/admin/jobs" className="accounts-insight-link"><strong>{number(stats.pendingJobs)}</strong> job{stats.pendingJobs === 1 ? "" : "s"} to review</Link>
      <button type="button" onClick={() => update({ status: "no-jobs" })}><strong>{number(stats.noJobs)}</strong> haven’t posted a job yet</button>
      <button type="button" onClick={() => update({ status: "suspended" })}><strong>{number(stats.suspended)}</strong> suspended</button>
    </div>

    {notice && <p className="recruiters-notice" role="status">{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice("")}><Icon name="close" size={14} /></button></p>}

    <section className="accounts-panel" aria-label="Recruiters list">
      <div className="accounts-toolbar recruiters-toolbar">
        <label className="accounts-search"><Icon name="search" /><span className="accounts-sr">Search recruiters</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or email" maxLength={100} />{search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); update({ q: "" }); }}><Icon name="close" size={15} /></button>}</label>
        <SignatureButton tone="gold" icon={<Icon name="clock" size={15} />} href="/admin?view=requests">{stats.pendingRequests ? `Requests (${stats.pendingRequests})` : "Requests"}</SignatureButton>
        <div className="accounts-chips" role="group" aria-label="Recruiter status">{([["all", "All"], ["verified", "Verified"], ["unverified", "Unverified"], ["suspended", "Suspended"], ["no-jobs", "No jobs yet"]] as const).map(([status, label]) => <button type="button" key={status} aria-pressed={query.status === status} className={query.status === status ? "is-on" : ""} onClick={() => update({ status })}>{label}</button>)}</div>
        <div className="accounts-selects"><label><span>Sort</span><select value={query.sort} onChange={event => update({ sort: event.target.value as RecruiterQuery["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="jobs">Most jobs</option><option value="active">Recently active</option></select></label></div>
      </div>
      <div className="accounts-summary"><p aria-live="polite">{pagination.matching ? <>Showing <strong>{first}–{last}</strong> of <strong>{number(pagination.matching)}</strong> {pagination.matching === 1 ? "recruiter" : "recruiters"}</> : "No recruiters to show"}{pending && <span className="accounts-loading"> · Updating…</span>}</p>{filtered && <button type="button" onClick={() => { setSearch(""); update({ ...defaults }); }}>Clear filters</button>}</div>

      {data.recruiters.length ? <div className={`accounts-list${pending ? " is-pending" : ""}`} role="table" aria-label="Recruiters">
        <div className="accounts-row recruiters-row accounts-head" role="row"><span role="columnheader">Recruiter</span><span role="columnheader">Status</span><span role="columnheader">Jobs</span><span role="columnheader">Live jobs</span><span role="columnheader">Applications</span><span role="columnheader">Last sign-in</span><span aria-hidden="true" /></div>
        {data.recruiters.map(recruiter => <Row key={recruiter.id} recruiter={recruiter} onOpen={() => setOpen(recruiter)} />)}
      </div> : <div className="accounts-empty"><span><Icon name="users" size={26} /></span><h3>{filtered ? "No recruiters match" : "No recruiters yet"}</h3><p>{filtered ? "Try a different search, or clear the filters." : "Job seekers can ask to become recruiters from their dashboard. Approved requests appear here."}</p>{filtered ? <SignatureButton tone="teal" icon={<Icon name="undo" size={15} />} onClick={() => { setSearch(""); update({ ...defaults }); }}>Clear filters</SignatureButton> : <SignatureButton tone="gold" icon={<Icon name="clock" size={15} />} href="/admin?view=requests">See requests</SignatureButton>}</div>}

      {pagination.pageCount > 1 && <nav className="accounts-pages" aria-label="Pages">
        <button type="button" disabled={pagination.page <= 1} onClick={() => update({ page: pagination.page - 1 })}>Previous</button>
        <span>Page {pagination.page} of {pagination.pageCount}</span>
        <button type="button" disabled={pagination.page >= pagination.pageCount} onClick={() => update({ page: pagination.page + 1 })}>Next</button>
      </nav>}
    </section>

    <details className="recruiters-log"><summary><Icon name="clock" size={16} />Recent administrator activity<span>{data.activity.length ? `Latest ${data.activity.length}` : "Nothing yet"}</span></summary>
      {data.activity.length ? <ol className="accounts-timeline">{data.activity.map(entry => <li key={entry.id}><strong>{auditText(entry.action)}</strong><span>{dateTime(entry.createdAt)} · by {entry.by}</span></li>)}</ol> : <p className="accounts-muted">Administrator actions will appear here.</p>}
    </details>

    {open && <RecruiterModal preview={open} onClose={() => setOpen(null)} onChanged={refresh} />}
  </div>;
}

function Row({ recruiter, onOpen }: { recruiter: Recruiter; onOpen: () => void }) {
  const prefetch = () => void loadDetail(recruiter.id).catch(() => {});
  return <button type="button" className="accounts-row recruiters-row" role="row" onClick={onOpen} onPointerEnter={prefetch} onFocus={prefetch} aria-label={`Open ${recruiter.name || recruiter.email}`}>
    <span role="cell" className="accounts-member"><Avatar name={recruiter.name} email={recruiter.email} /><span><strong>{recruiter.name || "No name yet"}{recruiter.verified && <> <VerifiedBadge compact /></>}</strong><span>{recruiter.email}</span></span></span>
    <span role="cell" className="accounts-badges">{recruiter.suspended ? <em className="is-danger">Suspended</em> : recruiter.verified ? <em className="is-good">Verified</em> : <em className="is-warn">Unverified</em>}{recruiter.totalJobs === 0 && <em className="is-plain">No jobs yet</em>}</span>
    <span role="cell" className="accounts-apps"><strong>{recruiter.totalJobs}</strong> in total</span>
    <span role="cell" className="accounts-apps"><strong>{recruiter.liveJobs}</strong> live</span>
    <span role="cell" className="accounts-apps"><strong>{recruiter.applications}</strong> received</span>
    <span role="cell" className="accounts-seen"><i className={`is-${freshness(recruiter.lastSignInAt)}`} />{relative(recruiter.lastSignInAt)}</span>
    <span className="accounts-chevron" aria-hidden="true"><Icon name="chevron" /></span>
  </button>;
}

function useDialog(onClose: () => void) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return { ref: dialog, close: () => dialog.current?.close(), props: { onClose, onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) dialog.current?.close(); } } };
}

function RecruiterModal({ preview, onClose, onChanged }: { preview: Recruiter; onClose: () => void; onChanged: () => void }) {
  const { ref, close, props } = useDialog(onClose);
  const [recruiter, setRecruiter] = useState<RecruiterDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [demoted, setDemoted] = useState(false);
  const id = preview.id;
  async function load(fresh = false) {
    try { setRecruiter(await loadDetail(id, fresh)); setError(""); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "This recruiter could not be loaded."); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(key: string, work: () => Promise<unknown>, success: string, reload = true) {
    setBusy(key); setNotice(null);
    try { await work(); setNotice({ text: success }); setConfirm(""); if (reload) await load(true); onChanged(); return true; }
    catch (problem) { setNotice({ text: problem instanceof Error ? problem.message : "That did not work.", bad: true }); return false; }
    finally { setBusy(""); }
  }
  const suspended = recruiter ? recruiter.status === "SUSPENDED" : preview.suspended;
  const totalApplications = recruiter ? recruiter.jobs.reduce((sum, job) => sum + job.applications, 0) : preview.applications;
  const jobCount = recruiter?.jobs.length ?? preview.totalJobs;

  return <dialog ref={ref} className="accounts-modal" aria-labelledby="recruiter-modal-title" {...props}>
    <div className="accounts-modal-panel">
      <header className="accounts-modal-head recruiters-modal-head">
        <Avatar name={preview.name} email={preview.email} large /><div><h2 id="recruiter-modal-title">{recruiter?.name ?? preview.name ?? "No name yet"}</h2><p>{preview.email}</p><div className="accounts-badges">{demoted ? <em className="is-plain">Now a job seeker</em> : suspended ? <em className="is-danger">Suspended</em> : <em className="is-good">Active</em>}{(recruiter ? !!recruiter.verification : preview.verified) && <VerifiedBadge />}</div></div>
        <button type="button" className="accounts-modal-close" aria-label="Close" onClick={close}><Icon name="close" /></button>
      </header>
      <div className="accounts-modal-body">
        <div className="accounts-facts">
          <Fact icon="clock" label="Last sign-in" value={relative(recruiter?.lastSignInAt ?? preview.lastSignInAt)} sub={dateTime(recruiter?.lastSignInAt ?? preview.lastSignInAt)} />
          <Fact icon="briefcase" label="Jobs" value={`${preview.liveJobs} live`} sub={`${jobCount} job${jobCount === 1 ? "" : "s"} in total`} />
          <Fact icon="file" label="Applications" value={`${totalApplications} received`} sub="Paid submissions" />
          <Fact icon="users" label="Member since" value={date(recruiter?.createdAt ?? preview.createdAt)} sub={suspended ? "Account suspended" : "Account active"} />
        </div>
        {error && <p className="accounts-modal-error" role="alert">{error} <button type="button" className="accounts-ghost" onClick={() => void load(true)}>Try again</button></p>}
        {!recruiter && !error && <div className="accounts-skeleton" aria-label="Loading recruiter details"><span /><span /><span /></div>}
        {recruiter && <div className="accounts-modal-grid">
          <div>
            <Verification recruiter={recruiter} busy={busy} onVerify={(checks, note) => act("verify", () => send(`/api/admin/recruiters/${id}/verification`, "POST", { checks, note }), "Marked as a verified recruiter.")} onUnverify={() => act("verify", () => send(`/api/admin/recruiters/${id}/verification`, "DELETE"), "Verification removed.")} />
            <Section title="Jobs">{recruiter.jobs.length ? <ul className="accounts-apps-list">{recruiter.jobs.map(job => <li key={job.id}><span><strong>{job.title}</strong><span>Deadline {date(job.deadline)} · {job.applications} application{job.applications === 1 ? "" : "s"}</span></span><span className="accounts-app-meta"><em className={`is-job-${job.status.toLowerCase()}`}>{statusLabels[job.status]}</em>{job.status === "PENDING_REVIEW" && <Link href={`/admin/jobs/${job.id}`} className="recruiters-review">Review →</Link>}</span></li>)}</ul> : <p className="accounts-muted">No jobs posted yet.</p>}</Section>
          </div>
          <div>
            <Section title="Recent activity">{recruiter.audit.length ? <ol className="accounts-timeline">{recruiter.audit.map(entry => <li key={entry.id}><strong>{auditText(entry.action)}</strong><span>{dateTime(entry.createdAt)} · by {entry.by}</span></li>)}</ol> : <p className="accounts-muted">No recorded events.</p>}</Section>
            {recruiter.request && <Section title="From their request"><dl className="accounts-dl">
              <div className="is-wide"><dt>Hiring for</dt><dd>{recruiter.request.hiringFor}</dd></div>
              <div className="is-wide"><dt>Roles</dt><dd>{recruiter.request.roles}</dd></div>
              <div><dt><Icon name="phone" size={15} />Phone</dt><dd><a href={`tel:${recruiter.request.phone}`}>{recruiter.request.phone}</a></dd></div>
              <div><dt><Icon name="pin" size={15} />Location</dt><dd>{recruiter.request.location}</dd></div>
              {recruiter.request.website && <div className="is-wide"><dt>Website or social</dt><dd><a href={/^https?:/.test(recruiter.request.website) ? recruiter.request.website : `https://${recruiter.request.website}`} target="_blank" rel="noopener noreferrer">{recruiter.request.website}</a></dd></div>}
            </dl></Section>}
            <Section title="Account"><p className="recruiters-help"><Link href={`/admin/accounts?q=${encodeURIComponent(preview.email)}`} className="recruiters-review">Open in Accounts →</Link> to see their profile, CVs and sign-in details.</p></Section>
          </div>
        </div>}
      </div>
      <footer className="accounts-modal-foot">
        {notice && <p role="status" className={notice.bad ? "is-bad" : ""}>{notice.text}</p>}
        {!demoted && (confirm === "demote"
          ? <><span className="accounts-confirm">Change to a job seeker? Their jobs stay, but they can no longer manage them.</span><button type="button" className="accounts-ghost" onClick={() => setConfirm("")}>Cancel</button><button type="button" className="accounts-ghost" disabled={!!busy} onClick={() => void act("demote", () => send("/api/admin/account-type", "POST", { userId: id, role: "APPLICANT" }), "Changed to a job seeker.", false).then(done => done && setDemoted(true))}>{busy === "demote" ? "Working…" : "Yes, change"}</button></>
          : <button type="button" className="accounts-ghost" onClick={() => setConfirm("demote")}>Change to job seeker</button>)}
        {!demoted && (suspended
          ? <SignatureButton tone="green" icon={<Icon name="undo" size={15} />} disabled={!!busy} onClick={() => void act("status", () => send(`/api/admin/users/${id}`, "PATCH", { suspended: false }), "Account reactivated.")}>{busy === "status" ? "Working…" : "Reactivate"}</SignatureButton>
          : confirm === "suspend"
            ? <><span className="accounts-confirm">Suspend? They're signed out and their jobs leave the site.</span><button type="button" className="accounts-ghost" onClick={() => setConfirm("")}>Cancel</button><SignatureButton tone="rose" icon={<Icon name="ban" size={15} />} disabled={!!busy} onClick={() => void act("status", () => send(`/api/admin/users/${id}`, "PATCH", { suspended: true }), "Account suspended.")}>{busy === "status" ? "Working…" : "Yes, suspend"}</SignatureButton></>
            : <SignatureButton tone="rose" icon={<Icon name="ban" size={15} />} onClick={() => setConfirm("suspend")}>Suspend</SignatureButton>)}
      </footer>
    </div>
  </dialog>;
}

const checkLabels: Record<string, string> = { email: "Email address confirmed", phone: "Phone number confirmed by call or message", identity: "Identity or business confirmed", presence: "Online presence or premises checked" };
function Verification({ recruiter, busy, onVerify, onUnverify }: { recruiter: RecruiterDetail; busy: string; onVerify: (checks: string[], note: string) => Promise<boolean>; onUnverify: () => Promise<boolean> }) {
  const [checks, setChecks] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (recruiter.verification) return <Section title="Verification"><div className="verify-done"><VerifiedBadge /><p>Verified {date(recruiter.verification.at)} by {recruiter.verification.by}</p>
    <ul>{recruiter.verification.checks.map(check => <li key={check}><Icon name="check" size={14} />{checkLabels[check] ?? check}</li>)}</ul>
    {recruiter.verification.note && <p className="verify-note">“{recruiter.verification.note}”</p>}
    {confirmRemove ? <p className="verify-actions"><span className="accounts-confirm">Remove the Verified badge from their jobs?</span><button type="button" className="recruiters-danger" disabled={!!busy} onClick={() => void onUnverify().then(() => setConfirmRemove(false))}>Remove</button><button type="button" className="recruiters-text" onClick={() => setConfirmRemove(false)}>Keep</button></p>
      : <button type="button" className="recruiters-text" onClick={() => setConfirmRemove(true)}>Remove verification</button>}</div></Section>;
  const ready = recruiter.emailVerified && checks.includes("phone") && checks.includes("identity");
  const phone = recruiter.request?.phone || recruiter.profile?.phone;
  return <Section title="Verify this recruiter"><div className="verify-box">
    <p className="recruiters-help">Contact them, confirm these, then mark them verified. Their jobs will show a Verified badge.</p>
    <ul className="verify-checks">
      <li className={recruiter.emailVerified ? "is-auto" : "is-missing"}><Icon name={recruiter.emailVerified ? "check" : "close"} size={14} /><span>{checkLabels.email}<small>{recruiter.emailVerified ? `${recruiter.email} · checked automatically` : "They need to confirm their email first"}</small></span></li>
      {(["phone", "identity", "presence"] as const).map(check => <li key={check}><label><input type="checkbox" checked={checks.includes(check)} onChange={event => setChecks(current => event.target.checked ? [...current, check] : current.filter(item => item !== check))} /><span>{checkLabels[check]}{check === "presence" ? <em> (optional)</em> : null}<small>{check === "phone" ? (phone ? <a href={`tel:${phone}`}>{phone}</a> : "No phone on record") : check === "identity" ? (recruiter.request?.hiringFor ?? "Who they hire for") : (recruiter.request?.website ?? "Website, social page or physical premises")}</small></span></label></li>)}
    </ul>
    <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={2} placeholder="Note for the record (optional), e.g. Spoke to Achieng on 15 Nov, confirmed the Westlands café." aria-label="Verification note" />
    <SignatureButton tone="green" icon={<Icon name="check" size={15} />} disabled={!ready || !!busy} onClick={() => void onVerify(checks, note)}>{busy === "verify" ? "Saving…" : "Mark as verified"}</SignatureButton>
  </div></Section>;
}

function Fact({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub: string }) {
  return <div className="accounts-fact"><span className="accounts-fact-icon"><Icon name={icon} size={16} /></span><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="accounts-section"><h3>{title}</h3>{children}</section>;
}
