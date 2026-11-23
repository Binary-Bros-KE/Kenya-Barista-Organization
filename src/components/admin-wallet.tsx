"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { avatarSrc } from "@/lib/images";
import { formatDeadline, formatFee } from "@/lib/job-format";
import { initialsOf } from "./profile-card";

// Wallet top-ups for administrators: claims waiting to be checked against the M-Pesa statement come first.
// Confirming credits the member's wallet; rejecting needs a reason. Processed claims are read-only.
type Status = "PENDING" | "CONFIRMED" | "REJECTED";
type Claim = { id: string; amountMinor: number; creditedMinor: number | null; mpesaCode: string; paidAt: string; status: Status; reviewNote: string | null; reviewedAt: string | null; createdAt: string;
  user: { id: string; name: string | null; email: string; avatarVersion: number | null; walletBalanceMinor: number; role: string }; reviewedBy: { name: string | null; email: string } | null };
type Data = { status: Status; claims: Claim[]; settings: { phone: string | null; name: string | null }; counts: Record<Status, number>; pendingMinor: number; creditedMinor: number; pagination: { page: number; total: number; pageCount: number } };

const tabs: [Status, string][] = [["PENDING", "To confirm"], ["CONFIRMED", "Confirmed"], ["REJECTED", "Rejected"]];
const ago = (value: string) => { const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000); return minutes < 60 ? `${Math.max(1, minutes)} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`; };
async function send(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That didn't work. Please try again.");
  return data;
}

export function AdminWallet() {
  const [status, setStatus] = useState<Status>("PENDING"), [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { setData(await send(`/api/admin/wallet?status=${status}&page=${page}`)); setError(""); } catch (problem) { setError((problem as Error).message); }
  }, [status, page]);
  useEffect(() => { void load(); }, [load]);

  return <div className="topups">
    <div className="topups-bar">
      <div className="topups-tabs" role="tablist" aria-label="Top-ups by status">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={status === value} className={"is-" + value.toLowerCase() + (status === value ? " is-on" : "")} onClick={() => { setStatus(value); setPage(1); }}>{label}<span>{data?.counts[value] ?? "·"}</span></button>)}</div>
      {data && <NumberWidget settings={data.settings} onSaved={() => { setNotice("Top-up number saved."); void load(); }} />}
    </div>
    {data && <dl className="topups-stats"><div className="is-gold"><dt>Waiting to confirm</dt><dd>{formatFee(data.pendingMinor)}</dd></div><div className="is-green"><dt>Credited to wallets</dt><dd>{formatFee(data.creditedMinor)}</dd></div><div className="is-blue"><dt>Claims to check</dt><dd>{data.counts.PENDING}</dd></div></dl>}
    {data && !data.settings.phone && <p className="topups-warning">Members can&apos;t top up until you set the M-Pesa number above.</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {error && <p className="notice error" role="alert">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
    {!data ? <div className="employer-loading" role="status"><span aria-hidden="true" />Loading top-ups…</div>
      : !data.claims.length ? <div className="topups-empty"><strong>{status === "PENDING" ? "All caught up" : "Nothing here yet"}</strong><span>{status === "PENDING" ? "New top-up claims appear here for you to check against the M-Pesa statement." : "Processed top-ups will be listed here."}</span></div>
      : <section className={"topups-table is-" + status.toLowerCase()} aria-label="Top-ups">
        <div className="topups-head" aria-hidden="true"><span>Member</span><span>M-Pesa code</span><span>Paid at</span><span>{status === "CONFIRMED" ? "Credited" : "Amount"}</span><span>Wallet now</span><span>{status === "PENDING" ? "Credit and decide" : "Outcome"}</span></div>
        <ul>{data.claims.map(claim => <TopUpCard key={claim.id} claim={claim} onDone={message => { setNotice(message); void load(); }} />)}</ul>
        {status === "PENDING" && <p className="topups-foot">Check each code and amount on the M-Pesa statement before confirming. Confirmed and rejected top-ups can&apos;t be changed.</p>}
      </section>}
    {data && data.pagination.pageCount > 1 && <nav className="djobs-pages" aria-label="Top-up pages"><span>Page {page} of {data.pagination.pageCount}</span><div>{page > 1 && <button type="button" className="underline" onClick={() => setPage(page - 1)}>&larr; Previous</button>}{page < data.pagination.pageCount && <button type="button" className="underline" onClick={() => setPage(page + 1)}>Next &rarr;</button>}</div></nav>}
  </div>;
}

function TopUpCard({ claim, onDone }: { claim: Claim; onDone: (message: string) => void }) {
  const [credit, setCredit] = useState(String(claim.amountMinor / 100));
  const [rejecting, setRejecting] = useState(false), [note, setNote] = useState(""), [sure, setSure] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const photo = avatarSrc(claim.user.id, claim.user.avatarVersion, 80), who = claim.user.name || claim.user.email;
  const creditKes = Number(credit), creditOk = Number.isInteger(creditKes) && creditKes >= 1;
  async function decide(decision: "confirm" | "reject") {
    if (decision === "confirm" && !sure) { setSure(true); setTimeout(() => setSure(false), 5000); return; }
    setBusy(true); setError("");
    try {
      await send(`/api/admin/wallet/${claim.id}`, { method: "POST", body: JSON.stringify(decision === "confirm" ? { decision, creditedKes: creditKes } : { decision, note }) });
      onDone(decision === "confirm" ? `${formatFee(creditKes * 100)} credited to ${who}'s wallet. They've been emailed.` : `Top-up from ${who} rejected. They've been emailed the reason.`);
    } catch (problem) { setError((problem as Error).message); setSure(false); } finally { setBusy(false); }
  }
  // One row: member, M-Pesa code, when they paid, the amount, their wallet, then the decision.
  return <li className={"topup-row is-" + claim.status.toLowerCase() + (rejecting ? " is-rejecting" : "")}>
    <div className="topup-row-who"><span className="topup-avatar">{photo ? <img src={photo} alt="" /> : initialsOf(who)}</span><div><strong>{who}</strong><a href={`mailto:${claim.user.email}`}>{claim.user.email}</a></div></div>
    <div className="topup-row-code" data-label="M-Pesa code"><code>{claim.mpesaCode}</code></div>
    <div className="topup-row-time" data-label="Paid at"><strong>{formatDeadline(claim.paidAt)}</strong><span>Sent {ago(claim.createdAt)}</span></div>
    <div className="topup-row-amount" data-label={claim.status === "CONFIRMED" ? "Credited" : "Amount"}><strong>{formatFee(claim.creditedMinor ?? claim.amountMinor)}</strong>{claim.status === "CONFIRMED" && claim.creditedMinor !== claim.amountMinor && <span>Claimed {formatFee(claim.amountMinor)}</span>}</div>
    <div className="topup-row-wallet" data-label="Wallet now">{formatFee(claim.user.walletBalanceMinor)}</div>
    {claim.status === "PENDING" ? <div className="topup-row-actions">
      <label className="topup-credit" title="Enter the amount shown on the M-Pesa statement"><span>KES</span><input inputMode="numeric" value={credit} onChange={event => { setCredit(event.target.value.replace(/\D/g, "")); setSure(false); }} aria-label={`Amount to credit ${who} in KES`} /></label>
      <button type="button" className={"topup-confirm" + (sure ? " is-sure" : "")} disabled={busy || !creditOk || rejecting} onClick={() => void decide("confirm")}>{busy && !rejecting ? "Crediting…" : sure ? "Tap again" : "✓ Confirm"}</button>
      <button type="button" className="topup-reject-open" disabled={busy} aria-expanded={rejecting} onClick={() => setRejecting(!rejecting)}>{rejecting ? "Cancel" : "Reject"}</button>
    </div> : <div className={"topup-row-outcome is-" + claim.status.toLowerCase()}><strong>{claim.status === "CONFIRMED" ? "✓ Confirmed" : "✕ Rejected"}</strong><span>{claim.reviewedBy?.name || claim.reviewedBy?.email || "KBO"}{claim.reviewedAt ? ` · ${formatDeadline(claim.reviewedAt)}` : ""}</span></div>}
    {rejecting && <form className="topup-reject" onSubmit={(event: FormEvent) => { event.preventDefault(); void decide("reject"); }}>
      <input value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={`Why are you rejecting ${who}'s top-up? e.g. This code isn't on the M-Pesa statement.`} aria-label="Reason for rejecting" autoFocus />
      <button className="topup-reject-button" disabled={busy || note.trim().length < 5}>{busy ? "Rejecting…" : "Reject top-up"}</button>
    </form>}
    {claim.reviewNote && claim.status !== "PENDING" && <p className="topup-row-note">{claim.reviewNote}</p>}
    {error && <p className="notice error topup-row-error" role="alert">{error}</p>}
  </li>;
}

// The M-Pesa number and name members send money to, in one line.
function NumberWidget({ settings, onSaved }: { settings: Data["settings"]; onSaved: () => void }) {
  const [phone, setPhone] = useState(settings.phone ?? ""), [name, setName] = useState(settings.name ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const changed = phone !== (settings.phone ?? "") || name !== (settings.name ?? "");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await send("/api/admin/wallet/settings", { method: "PUT", body: JSON.stringify({ phone, name }) }); onSaved(); } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  }
  return <form className="topups-number" onSubmit={event => void save(event)} title="Members send their M-Pesa top-ups to this number">
    <span aria-hidden="true">M-PESA</span>
    <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="Top-up number" aria-label="M-Pesa number for top-ups" />
    <input value={name} onChange={event => setName(event.target.value)} placeholder="Name on M-Pesa" aria-label="Name M-Pesa shows for this number" />
    <button disabled={busy || !changed || !phone || !name}>{busy ? "Saving…" : "Save"}</button>
    {error && <em role="alert">{error}</em>}
  </form>;
}
