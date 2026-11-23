"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDeadline, formatFee } from "@/lib/job-format";

// The Wallet tab: balance, quick stats, claims waiting for confirmation, history, and the M-Pesa top-up popup.
type Entry = { id: string; kind: "TOP_UP" | "APPLICATION_FEE"; amountMinor: number; balanceAfterMinor: number; description: string; createdAt: string | Date; topUp: { mpesaCode: string } | null; paymentOrder: { applicationId: string } | null };
type Claim = { id: string; amountMinor: number; creditedMinor: number | null; mpesaCode: string; paidAt: string | Date; status: "PENDING" | "CONFIRMED" | "REJECTED"; reviewNote: string | null; reviewedAt: string | Date | null; createdAt: string | Date };
export type WalletData = { balanceMinor: number; settings: { phone: string | null; name: string | null }; entries: Entry[]; claims: Claim[]; stats: { toppedUpMinor: number; spentMinor: number; pendingMinor: number }; limits: { minKes: number; maxKes: number; pending: number } };

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const icons = {
  wallet: "M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v3m0 4h-4a2 2 0 0 1 0-4h4v4z",
  plus: "M12 5v14M5 12h14", down: "M12 5v14m-6-6 6 6 6-6", up: "M12 19V5m-6 6 6-6 6 6", clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  x: "M18 6 6 18M6 6l12 12", check: "m5 12.5 4.5 4.5L19 7.5", copy: "M8 8h11v11H8zM5 16H4V5h11v1", jobs: "M3 7h18v13H3zM8 7V4h8v3",
};
const when = (value: string | Date) => formatDeadline(value);

export function WalletView({ data }: { data: WalletData }) {
  const params = useSearchParams();
  const suggested = Number(params.get("topup")) || undefined;
  const [open, setOpen] = useState(!!params.get("topup"));
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const pending = data.claims.filter(claim => claim.status === "PENDING");

  // One history: ledger entries plus claims that never became entries (pending or rejected).
  const history = useMemo(() => {
    const rows = [
      ...data.entries.map(entry => ({ key: entry.id, at: new Date(entry.createdAt), type: entry.kind === "TOP_UP" ? "in" as const : "out" as const, entry })),
      ...data.claims.filter(claim => claim.status !== "CONFIRMED").map(claim => ({ key: claim.id, at: new Date(claim.createdAt), type: "claim" as const, claim })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());
    return rows.filter(row => filter === "all" || (filter === "in" ? row.type !== "out" : row.type === "out"));
  }, [data, filter]);

  return <div className="wallet">
    <section className="wallet-hero">
      <div className="wallet-hero-main">
        <span className="wallet-hero-label"><Icon d={icons.wallet} /> Wallet balance</span>
        <strong className="wallet-balance">{formatFee(data.balanceMinor)}</strong>
        <p>Use it to pay application fees in one tap.{data.stats.pendingMinor > 0 && <> <span className="wallet-hero-pending">{formatFee(data.stats.pendingMinor)} waiting to be confirmed</span></>}</p>
        <div className="wallet-hero-actions">
          <button type="button" className="wallet-topup-button" onClick={() => setOpen(true)}><Icon d={icons.plus} /> Top up</button>
          <Link href="/dashboard/jobs" className="wallet-ghost-button"><Icon d={icons.jobs} /> Find jobs</Link>
        </div>
      </div>
      <div className="wallet-hero-card" aria-hidden="true"><span className="wallet-chip" /><span className="wallet-hero-brand">KBO</span><span className="wallet-hero-mpesa">M-PESA top-ups</span></div>
    </section>

    <dl className="wallet-stats">
      <div className="is-teal"><dt><Icon d={icons.down} /> Topped up</dt><dd>{formatFee(data.stats.toppedUpMinor)}</dd></div>
      <div className="is-rose"><dt><Icon d={icons.up} /> Spent on applications</dt><dd>{formatFee(data.stats.spentMinor)}</dd></div>
      <div className="is-gold"><dt><Icon d={icons.clock} /> Waiting for confirmation</dt><dd>{formatFee(data.stats.pendingMinor)}</dd></div>
    </dl>

    {pending.length > 0 && <section className="wallet-pending" aria-labelledby="wallet-pending-title">
      <h2 id="wallet-pending-title"><span className="wallet-pulse" aria-hidden="true" /> Waiting for KBO to confirm</h2>
      <ul>{pending.map(claim => <li key={claim.id}><strong>{formatFee(claim.amountMinor)}</strong><span>M-Pesa <code>{claim.mpesaCode}</code></span><span>Paid {when(claim.paidAt)}</span><em>Usually confirmed within a few hours on working days</em></li>)}</ul>
    </section>}

    <section className="wallet-history" aria-labelledby="wallet-history-title">
      <header><h2 id="wallet-history-title">History</h2>
        <div className="wallet-filters" role="group" aria-label="Filter history">{([["all", "All"], ["in", "Top-ups"], ["out", "Applications"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "is-on" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </header>
      {!history.length ? <div className="wallet-empty"><span aria-hidden="true"><Icon d={icons.wallet} size={26} /></span><strong>No activity yet</strong><p>Top up by M-Pesa, then pay application fees straight from your wallet.</p><button type="button" className="wallet-topup-button" onClick={() => setOpen(true)}><Icon d={icons.plus} /> Top up</button></div>
        : <ol>{history.map(row => row.type === "claim" ? <li key={row.key} className={"wallet-row is-" + row.claim.status.toLowerCase()}>
            <span className="wallet-row-icon"><Icon d={row.claim.status === "PENDING" ? icons.clock : icons.x} /></span>
            <div><strong>{row.claim.status === "PENDING" ? "Top-up waiting for confirmation" : "Top-up not confirmed"}</strong><span>M-Pesa {row.claim.mpesaCode} · {when(row.claim.createdAt)}</span>{row.claim.reviewNote && row.claim.status === "REJECTED" && <p>Reason: {row.claim.reviewNote}</p>}</div>
            <b className="wallet-row-amount">{formatFee(row.claim.amountMinor)}</b>
          </li> : <li key={row.key} className={"wallet-row is-" + row.type}>
            <span className="wallet-row-icon"><Icon d={row.type === "in" ? icons.down : icons.up} /></span>
            <div><strong>{row.entry.kind === "TOP_UP" ? "Wallet top-up" : row.entry.description}</strong><span>{row.entry.topUp ? `M-Pesa ${row.entry.topUp.mpesaCode} · ` : ""}{when(row.entry.createdAt)}{row.entry.paymentOrder && <> · <Link href={`/dashboard/applications/${row.entry.paymentOrder.applicationId}`}>View application</Link></>}</span></div>
            <div className="wallet-row-side"><b className="wallet-row-amount">{row.entry.amountMinor > 0 ? "+" : "−"}{formatFee(Math.abs(row.entry.amountMinor))}</b><small>Balance {formatFee(row.entry.balanceAfterMinor)}</small></div>
          </li>)}</ol>}
    </section>
    {open && <TopUpModal settings={data.settings} limits={data.limits} suggestedKes={suggested} onClose={() => setOpen(false)} />}
  </div>;
}

// Nairobi "now" for a datetime-local input.
function nairobiNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function TopUpModal({ settings, limits, suggestedKes, onClose }: { settings: WalletData["settings"]; limits: WalletData["limits"]; suggestedKes?: number; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(suggestedKes ? String(Math.max(limits.minKes, Math.ceil(suggestedKes))) : "");
  const [code, setCode] = useState("");
  const [paidAt, setPaidAt] = useState(nairobiNow());
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<null | { amount: string; code: string }>(null), [copied, setCopied] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const amountKes = Number(amount);
  const amountOk = Number.isInteger(amountKes) && amountKes >= limits.minKes && amountKes <= limits.maxKes;
  const codeOk = /^[A-Z0-9]{10}$/.test(code);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/wallet/top-ups", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountKes, mpesaCode: code, paidAt: `${paidAt}:00+03:00` }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Your top-up couldn't be sent. Please try again.");
      setDone({ amount: formatFee(amountKes * 100), code }); router.refresh();
    } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); }
  }
  function copy() { if (!settings.phone) return; void navigator.clipboard?.writeText(settings.phone.replace(/\s/g, "")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  return <dialog ref={dialog} className="job-create topup-modal" aria-labelledby="topup-title" onClose={onClose}>
    <div className="job-create-panel">
      <header className="job-create-head topup-head"><div><h2 id="topup-title">Top up your wallet</h2><p>Send money by M-Pesa, then tell us the confirmation code.</p></div><button type="button" className="job-create-close" aria-label="Close" onClick={() => dialog.current?.close()}>&times;</button></header>
      {done ? <div className="job-create-body topup-done">
        <span className="topup-done-mark" aria-hidden="true"><Icon d={icons.check} size={34} /></span>
        <h3>Top-up sent for confirmation</h3>
        <p>We&apos;ll check M-Pesa code <code>{done.code}</code> for {done.amount} and email you as soon as it&apos;s in your wallet.</p>
        <button type="button" className="wallet-topup-button" onClick={() => dialog.current?.close()}>Done</button>
      </div> : !settings.phone ? <div className="job-create-body topup-done is-off">
        <span className="topup-done-mark" aria-hidden="true"><Icon d={icons.clock} size={30} /></span>
        <h3>Top-ups open soon</h3><p>KBO is setting up the M-Pesa number for top-ups. Please check back shortly.</p>
      </div> : <form className="job-create-body topup-body" onSubmit={event => void submit(event)} aria-busy={busy}>
        <ol className="topup-steps">
          <li><span>1</span><div><strong>Open M-Pesa</strong><p>On your phone, open the M-Pesa menu or the M-PESA app.</p></div></li>
          <li><span>2</span><div><strong>Choose Send Money</strong><p>Not Lipa na M-Pesa: this is a normal send.</p></div></li>
          <li><span>3</span><div><strong>Enter this phone number</strong>
            <div className="topup-number"><b>{settings.phone}</b><button type="button" onClick={copy}>{copied ? "Copied" : <><Icon d={icons.copy} size={15} /> Copy</>}</button></div>
            {settings.name && <p>Check the name shows <strong>{settings.name}</strong> before you send.</p>}</div></li>
          <li><span>4</span><div><strong>Enter the amount and send</strong>
            <label className="topup-amount"><span>KES</span><input inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 1000" aria-label="Amount in KES" required /></label>
            <p>Between KES {limits.minKes} and KES {limits.maxKes.toLocaleString("en-KE")}. Enter your M-Pesa PIN to send.</p></div></li>
          <li><span>5</span><div><strong>Tell us about the payment</strong><p>Copy these from the M-Pesa confirmation message.</p>
            <div className="topup-fields">
              <label>M-Pesa code<input value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="e.g. TKL4AB12CD" autoCapitalize="characters" spellCheck={false} required /></label>
              <label>Time you paid<input type="datetime-local" value={paidAt} onChange={event => setPaidAt(event.target.value)} max={nairobiNow()} required /></label>
            </div></div></li>
        </ol>
        {error && <p className="notice error" role="alert">{error}</p>}
        <footer className="topup-foot"><p>{amountOk ? <>You&apos;re claiming <strong>{formatFee(amountKes * 100)}</strong>. KBO confirms it against the M-Pesa statement.</> : "Enter the amount you sent."}</p>
          <button className="wallet-topup-button" disabled={busy || !amountOk || !codeOk || !paidAt}>{busy ? "Sending…" : "Submit top-up"}</button></footer>
      </form>}
    </div>
  </dialog>;
}

// On an application: pay the fee from the wallet and submit, or top up the difference.
// missing: what the saved draft still needs (cover letter, CV); paying stays disabled until it's empty.
export function WalletPay({ applicationId, version, feeMinor, balanceMinor, missing = "" }: { applicationId: string; version: number; feeMinor: number; balanceMinor: number; missing?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sure, setSure] = useState(false);
  const enough = balanceMinor >= feeMinor, shortKes = Math.ceil((feeMinor - balanceMinor) / 100), topUpKes = Math.max(shortKes, 10);
  async function pay() {
    if (!sure) { setSure(true); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/wallet-payment`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "The payment couldn't be completed.");
      router.refresh();
    } catch (problem) { setError((problem as Error).message); setSure(false); } finally { setBusy(false); }
  }
  return <section className="wallet-pay">
    <div className="wallet-pay-head"><span><Icon d={icons.wallet} /> Pay from wallet</span><Link href="/dashboard/wallet">Wallet</Link></div>
    <dl><div><dt>Balance</dt><dd>{formatFee(balanceMinor)}</dd></div><div><dt>Application fee</dt><dd>−{formatFee(feeMinor)}</dd></div><div className="is-after"><dt>After applying</dt><dd>{enough ? formatFee(balanceMinor - feeMinor) : "—"}</dd></div></dl>
    {enough ? <>
      <button type="button" className={"wallet-pay-button" + (sure ? " is-sure" : "")} disabled={busy || !!missing} onClick={() => void pay()}>{busy ? "Submitting…" : sure ? `Tap again to pay ${formatFee(feeMinor)} and submit` : `Pay ${formatFee(feeMinor)} and submit`}</button>
      <p className="wallet-pay-note">Your application is sent to the recruiter straight away.</p>
    </> : <>
      <p className="wallet-pay-short">You need {formatFee(shortKes * 100)} more to apply.</p>
      <Link className="wallet-pay-button is-topup" href={`/dashboard/wallet?topup=${topUpKes}`}>Top up {formatFee(topUpKes * 100)}</Link>
    </>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
