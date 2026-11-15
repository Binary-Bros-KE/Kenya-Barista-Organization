"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { AccountDetail, AccountList, AccountQuery } from "@/server/admin-accounts";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatFee, statusLabels } from "@/lib/job-format";
import { SignatureButton } from "./signature-button";
import { Avatar, Icon, date, dateTime, device, freshness, number, relative, type IconName } from "./admin-list-kit";

const auditLabels: Record<string, string> = { "account.suspended": "Account suspended", "account.reactivated": "Account reactivated", "admin.bootstrap": "Made administrator" };
const paymentLabels: Record<string, string> = { PENDING: "Payment pending", SUCCEEDED: "Paid", FAILED: "Payment failed", CANCELLED: "Payment cancelled", NEEDS_REVIEW: "Payment under review", REFUNDED: "Refunded" };

type Account = AccountList["accounts"][number];
const accountKind = (role: string) => role === "ADMIN" ? "Administrator" : role === "RECRUITER" ? "Recruiter" : "Job seeker";

// Account details are fetched once per page visit: on hover/focus (prefetch) or on open, then reused.
const detailCache = new Map<string, Promise<AccountDetail>>();
function loadDetail(id: string, fresh = false) {
  if (fresh) detailCache.delete(id);
  let request = detailCache.get(id);
  if (!request) {
    request = fetch(`/api/admin/users/${id}`, { cache: "no-store" }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "This account could not be loaded.");
      return body.account as AccountDetail;
    });
    request.catch(() => detailCache.delete(id));
    detailCache.set(id, request);
  }
  return request;
}
const defaults: Omit<AccountQuery, "page"> = { q: "", status: "all", type: "all", activity: "any", sort: "newest" };

export function AdminAccounts({ data, selfId }: { data: AccountList; selfId: string }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(data.query.q);
  const [open, setOpen] = useState<Account | null>(null);
  const { stats, query, pagination } = data;
  useEffect(() => { detailCache.clear(); }, [data]);

  function update(changes: Partial<AccountQuery>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === defaults[key as keyof typeof defaults] || (key === "page" && value === 1)) next.delete(key); else next.set(key, String(value));
    }
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }
  useEffect(() => {
    if (search.trim() === query.q) return;
    const timer = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = query.q || query.status !== "all" || query.type !== "all" || query.activity !== "any";
  const share = (value: number) => stats.total ? Math.round(value / stats.total * 100) : 0;
  const cards: { label: string; value: number; hint: string; icon: IconName; color: string; apply: Partial<AccountQuery> }[] = [
    { label: "All accounts", value: stats.total, hint: stats.newThisWeek ? `+${number(stats.newThisWeek)} joined this week` : "No new accounts this week", icon: "people", color: "teal", apply: { ...defaults } },
    { label: "Verified", value: stats.verified, hint: `${share(stats.verified)}% of all accounts`, icon: "check", color: "green", apply: { status: "verified" } },
    { label: "Unverified", value: stats.unverified, hint: "Still need to confirm their email", icon: "mail", color: "gold", apply: { status: "unverified" } },
    { label: "Active this month", value: stats.active30, hint: "Signed in during the last 30 days", icon: "pulse", color: "rose", apply: { activity: "30d" } },
  ];
  const insights: { label: string; value: number; apply?: Partial<AccountQuery> }[] = [
    { label: "with a screened CV", value: stats.withCv },
    { label: "have applied for a job", value: stats.applied },
    { label: "recruiters", value: stats.recruiters, apply: { type: "recruiters" } },
    { label: "suspended", value: stats.suspended, apply: { status: "suspended" } },
  ];
  const first = pagination.matching ? (pagination.page - 1) * 25 + 1 : 0, last = Math.min(pagination.page * 25, pagination.matching);

  return <div className="accounts overview">
    <section className="overview-stats is-compact" aria-label="Account summary">{cards.map(card => <button type="button" key={card.label} className={`overview-stat overview-stat-${card.color}`} onClick={() => update(card.apply)} aria-label={`${card.label}: ${number(card.value)}. Show these accounts`}>
      <span className="overview-stat-icon"><Icon name={card.icon} /></span><span className="overview-stat-label">{card.label}</span><strong>{number(card.value)}</strong>
      <span className="overview-stat-hint">{card.hint}<Icon name="chevron" size={14} /></span><span className="overview-stat-mark" aria-hidden="true"><Icon name={card.icon} /></span>
    </button>)}</section>

    <div className="accounts-insights"><Icon name="spark" size={16} /><span>At a glance:</span>{insights.map(item => item.apply
      ? <button type="button" key={item.label} onClick={() => update(item.apply!)}><strong>{number(item.value)}</strong> {item.label}</button>
      : <span key={item.label} className="accounts-insight"><strong>{number(item.value)}</strong> {item.label}</span>)}</div>

    <section className="accounts-panel" aria-label="Accounts list">
      <div className="accounts-toolbar">
        <label className="accounts-search"><Icon name="search" /><span className="accounts-sr">Search accounts</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, email, phone or location" maxLength={100} />{search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); update({ q: "" }); }}><Icon name="close" size={15} /></button>}</label>
        <div className="accounts-chips" role="group" aria-label="Account status">{(["all", "verified", "unverified", "suspended"] as const).map(status => <button type="button" key={status} aria-pressed={query.status === status} className={query.status === status ? "is-on" : ""} onClick={() => update({ status })}>{status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)}</button>)}</div>
        <div className="accounts-selects">
          <label><span>Type</span><select value={query.type} onChange={event => update({ type: event.target.value as AccountQuery["type"] })}><option value="all">Everyone</option><option value="applicants">Job seekers</option><option value="recruiters">Recruiters</option><option value="admins">Administrators</option></select></label>
          <label><span>Last sign-in</span><select value={query.activity} onChange={event => update({ activity: event.target.value as AccountQuery["activity"] })}><option value="any">Any time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="dormant">Over 90 days ago</option><option value="never">Never signed in</option></select></label>
          <label><span>Sort</span><select value={query.sort} onChange={event => update({ sort: event.target.value as AccountQuery["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="active">Recently active</option><option value="name">Name A–Z</option><option value="applications">Most applications</option></select></label>
        </div>
      </div>
      <div className="accounts-summary"><p aria-live="polite">{pagination.matching ? <>Showing <strong>{first}–{last}</strong> of <strong>{number(pagination.matching)}</strong> {pagination.matching === 1 ? "account" : "accounts"}</> : "No accounts to show"}{pending && <span className="accounts-loading"> · Updating…</span>}</p>{filtered && <button type="button" onClick={() => { setSearch(""); update({ ...defaults }); }}>Clear filters</button>}</div>

      {data.accounts.length ? <div className={`accounts-list${pending ? " is-pending" : ""}`} role="table" aria-label="Accounts">
        <div className="accounts-row accounts-head" role="row"><span role="columnheader">Member</span><span role="columnheader">Status</span><span role="columnheader">Readiness</span><span role="columnheader">Applications</span><span role="columnheader">Last sign-in</span><span role="columnheader">Joined</span><span aria-hidden="true" /></div>
        {data.accounts.map(account => <Row key={account.id} account={account} onOpen={() => setOpen(account)} />)}
      </div> : <div className="accounts-empty"><span><Icon name="search" size={26} /></span><h3>No accounts match</h3><p>Try a different search, or clear the filters to see everyone.</p>{filtered && <SignatureButton tone="teal" icon={<Icon name="undo" size={15} />} onClick={() => { setSearch(""); update({ ...defaults }); }}>Clear filters</SignatureButton>}</div>}

      {pagination.pageCount > 1 && <nav className="accounts-pages" aria-label="Pages">
        <button type="button" disabled={pagination.page <= 1} onClick={() => update({ page: pagination.page - 1 })}>Previous</button>
        <span>Page {pagination.page} of {pagination.pageCount}</span>
        <button type="button" disabled={pagination.page >= pagination.pageCount} onClick={() => update({ page: pagination.page + 1 })}>Next</button>
      </nav>}
    </section>

    {open && <AccountModal preview={open} selfId={selfId} onClose={() => setOpen(null)} onChanged={() => startTransition(() => router.refresh())} />}
  </div>;
}

function Row({ account, onOpen }: { account: Account; onOpen: () => void }) {
  const ready = [account.emailVerified, account.profileReady, account.hasCv];
  const kind = accountKind(account.role);
  return <button type="button" className="accounts-row" role="row" onClick={onOpen} onPointerEnter={() => void loadDetail(account.id).catch(() => {})} onFocus={() => void loadDetail(account.id).catch(() => {})} aria-label={`Open ${account.name || account.email}`}>
    <span role="cell" className="accounts-member"><Avatar name={account.name} email={account.email} /><span><strong>{account.name || "No name yet"}</strong><span>{account.email}</span></span></span>
    <span role="cell" className="accounts-badges">{account.status === "SUSPENDED" ? <em className="is-danger">Suspended</em> : account.emailVerified ? <em className="is-good">Verified</em> : <em className="is-warn">Unverified</em>}<em className="is-plain">{kind}</em></span>
    <span role="cell" className="accounts-ready" title={`Email ${ready[0] ? "verified" : "not verified"} · Profile ${ready[1] ? "complete" : "incomplete"} · CV ${ready[2] ? "screened" : "missing"}`}>{ready.map((done, index) => <i key={index} className={done ? "is-done" : ""} />)}<span>{ready.filter(Boolean).length}/3</span></span>
    <span role="cell" className="accounts-apps"><strong>{account.submitted}</strong> submitted{account.applications > account.submitted && <span>{account.applications - account.submitted} draft{account.applications - account.submitted === 1 ? "" : "s"}</span>}</span>
    <span role="cell" className="accounts-seen"><i className={`is-${freshness(account.lastSignInAt)}`} />{relative(account.lastSignInAt)}</span>
    <span role="cell" className="accounts-joined">{date(account.createdAt)}</span>
    <span className="accounts-chevron" aria-hidden="true"><Icon name="chevron" /></span>
  </button>;
}

function AccountModal({ preview, selfId, onClose, onChanged }: { preview: Account; selfId: string; onClose: () => void; onChanged: () => void }) {
  const id = preview.id;
  const dialog = useRef<HTMLDialogElement>(null);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load(fresh = false) {
    try { setAccount(await loadDetail(id, fresh)); setError(""); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "This account could not be loaded."); }
  }
  useEffect(() => { dialog.current?.showModal(); void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function changeAccess(request: () => Promise<Response>, success: string) {
    setBusy(true); setNotice("");
    try {
      const response = await request();
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "That did not work. Please try again.");
      setNotice(success); await load(true); onChanged();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : "That did not work. Please try again."); }
    finally { setBusy(false); }
  }
  async function setSuspended(suspended: boolean) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suspended }), credentials: "same-origin" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "That did not work. Please try again.");
      setNotice(suspended ? "Account suspended and signed out everywhere." : "Account reactivated.");
      setConfirming(false); await load(true); onChanged();
    } catch (problem) { setNotice(problem instanceof Error ? problem.message : "That did not work. Please try again."); }
    finally { setBusy(false); }
  }
  const canManage = account && account.role !== "ADMIN" && account.id !== selfId;
  const status = account?.status ?? preview.status, verified = account?.emailVerified ?? preview.emailVerified;
  const kind = accountKind(account?.role ?? preview.role);
  const submitted = account ? account.applications.filter(application => application.submittedAt).length : preview.submitted;
  const drafts = (account ? account.applications.length : preview.applications) - submitted;

  return <dialog ref={dialog} className="accounts-modal" aria-labelledby="account-modal-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="accounts-modal-panel">
      <header className="accounts-modal-head">
        <Avatar name={account?.profile?.fullName || account?.name || preview.name} email={preview.email} large /><div><h2 id="account-modal-title">{account?.profile?.fullName || account?.name || preview.name || "No name yet"}</h2><p>{preview.email}</p><div className="accounts-badges">{status === "SUSPENDED" ? <em className="is-danger">Suspended</em> : verified ? <em className="is-good">Verified</em> : <em className="is-warn">Unverified</em>}<em className="is-plain">{kind}</em>{(account?.twoFactorEnabled ?? preview.twoFactorEnabled) && <em className="is-plain">2FA on</em>}</div></div>
        <button type="button" className="accounts-modal-close" aria-label="Close" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
      </header>

      <div className="accounts-modal-body">
        <div className="accounts-facts">
          <Fact icon="clock" label="Last sign-in" value={relative(account?.lastSignInAt ?? preview.lastSignInAt)} sub={dateTime(account?.lastSignInAt ?? preview.lastSignInAt)} />
          <Fact icon="device" label="Last device" value={!account ? "…" : account.activeSessions ? device(account.lastDevice) : "Signed out"} sub={account ? `${account.activeSessions} active session${account.activeSessions === 1 ? "" : "s"}` : "Checking sessions"} />
          <Fact icon="briefcase" label="Applications" value={`${submitted} submitted`} sub={`${drafts} draft${drafts === 1 ? "" : "s"}`} />
          <Fact icon="people" label="Member since" value={date(account?.createdAt ?? preview.createdAt)} sub={!account ? (preview.emailVerified ? "Email confirmed" : "Email not confirmed yet") : account.emailVerifiedAt ? `Email confirmed ${date(account.emailVerifiedAt)}` : "Email not confirmed yet"} />
        </div>
        {error && <p className="accounts-modal-error" role="alert">{error} <button type="button" className="accounts-ghost" onClick={() => void load(true)}>Try again</button></p>}
        {!account && !error && <div className="accounts-skeleton" aria-label="Loading account details"><span /><span /><span /></div>}
        {account && <>

        <div className="accounts-modal-grid">
          <div>
            <Section title="Profile">{account.profile ? <dl className="accounts-dl">
              <div><dt><Icon name="phone" size={15} />Phone</dt><dd>{account.profile.phone ? <a href={`tel:${account.profile.phone}`}>{account.profile.phone}</a> : "—"}</dd></div>
              <div><dt><Icon name="pin" size={15} />Location</dt><dd>{account.profile.location || "—"}</dd></div>
              {account.profile.summary && <div className="is-wide"><dt>About</dt><dd>{account.profile.summary}</dd></div>}
            </dl> : <p className="accounts-muted">No profile details yet.</p>}</Section>
            <Section title="CVs">{account.documents.length ? <ul className="accounts-files">{account.documents.map(doc => <li key={doc.id}><Icon name="file" size={16} /><span><strong>{doc.filename}</strong><span>{Math.max(1, Math.round(doc.sizeBytes / 1024))} KB · {date(doc.createdAt)}</span></span><em className={doc.scanStatus === "CLEAN" ? "is-good" : doc.scanStatus === "PENDING" ? "is-warn" : "is-danger"}>{doc.scanStatus === "CLEAN" ? "Screened" : doc.scanStatus === "PENDING" ? "Screening" : "Blocked"}</em></li>)}</ul> : <p className="accounts-muted">No CV uploaded.</p>}</Section>
            <Section title="Account settings"><ul className="accounts-flags">
              <li className={account.twoFactorEnabled ? "is-on" : ""}><Icon name="shield" size={15} />Two-factor sign-in {account.twoFactorEnabled ? "on" : "off"}</li>
              <li className={account.notificationEmails ? "is-on" : ""}><Icon name="mail" size={15} />Email updates {account.notificationEmails ? "on" : "off"}</li>
            </ul></Section>
            {account.role !== "ADMIN" && <Section title="Account type"><div className="accounts-type" role="group" aria-label="Account type">{([["APPLICANT", "Job seeker", "Applies for jobs"], ["RECRUITER", "Recruiter", "Posts jobs and reviews applicants"]] as const).map(([role, label, help]) => <button type="button" key={role} aria-pressed={account.role === role} className={account.role === role ? "is-on" : ""} disabled={busy || account.role === role} onClick={() => void changeAccess(() => fetch("/api/admin/account-type", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: account.id, role }) }), role === "RECRUITER" ? "Now a recruiter. They see the recruiter dashboard next time they open a page." : "Now a job seeker. Their jobs stay as they are; they can no longer manage them.")}><strong>{label}</strong><span>{help}</span></button>)}</div></Section>}
            {account.jobs.length > 0 && <Section title="Their job postings"><ul className="accounts-apps-list">{account.jobs.map(job => <li key={job.id}><span><strong>{job.title}</strong><span>{job.applications} application{job.applications === 1 ? "" : "s"} · updated {date(job.updatedAt)}</span></span><span className="accounts-app-meta"><em className={`is-job-${job.status.toLowerCase()}`}>{statusLabels[job.status]}</em></span></li>)}</ul></Section>}
          </div>
          <div>
            <Section title="Applications">{account.applications.length ? <ul className="accounts-apps-list">{account.applications.map(application => <li key={application.id}><span><strong>{application.job.title}</strong><span>{application.job.recruiter.name || "KBO recruiter"} · {application.submittedAt ? `Submitted ${date(application.submittedAt)}` : `Updated ${date(application.updatedAt)}`}</span></span><span className="accounts-app-meta"><em className={`is-status-${application.status.toLowerCase()}`}>{applicationStatusLabels[application.status]}</em>{application.paymentOrder && <small>{paymentLabels[application.paymentOrder.status] ?? application.paymentOrder.status} · {formatFee(application.paymentOrder.amountMinor)}</small>}</span></li>)}</ul> : <p className="accounts-muted">No applications yet.</p>}</Section>
            <Section title="Recent activity">{account.audit.length ? <ol className="accounts-timeline">{account.audit.map(entry => <li key={entry.id}><strong>{auditLabels[entry.action] ?? entry.action.replace(/[._]/g, " ")}</strong><span>{dateTime(entry.createdAt)} · by {entry.by}</span></li>)}</ol> : <p className="accounts-muted">No recorded account events.</p>}</Section>
          </div>
        </div>
        </>}
      </div>

      {account && <footer className="accounts-modal-foot">
        {notice && <p role="status">{notice}</p>}
        <SignatureButton tone="teal" icon={<Icon name="mail" size={15} />} href={`mailto:${account.email}`}>Email</SignatureButton>
        {canManage && (account.status === "SUSPENDED"
          ? <SignatureButton tone="green" icon={<Icon name="undo" size={15} />} disabled={busy} onClick={() => void setSuspended(false)}>{busy ? "Working…" : "Reactivate account"}</SignatureButton>
          : confirming
            ? <><span className="accounts-confirm">Suspend and sign out everywhere?</span><button type="button" className="accounts-ghost" onClick={() => setConfirming(false)}>Cancel</button><SignatureButton tone="rose" icon={<Icon name="ban" size={15} />} disabled={busy} onClick={() => void setSuspended(true)}>{busy ? "Working…" : "Yes, suspend"}</SignatureButton></>
            : <SignatureButton tone="rose" icon={<Icon name="ban" size={15} />} onClick={() => setConfirming(true)}>Suspend account</SignatureButton>)}
        {!canManage && account.role === "ADMIN" && <span className="accounts-muted">Administrator accounts can’t be suspended here.</span>}
      </footer>}
    </div>
  </dialog>;
}

function Fact({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub: string }) {
  return <div className="accounts-fact"><span className="accounts-fact-icon"><Icon name={icon} size={16} /></span><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="accounts-section"><h3>{title}</h3>{children}</section>;
}

