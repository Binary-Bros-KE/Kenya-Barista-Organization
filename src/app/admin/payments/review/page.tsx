import { paymentLabel } from "@/lib/payment-view";
import { AdminHeading } from "@/components/admin-ui";
import Link from "next/link";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
import { formatFee } from "@/lib/job-format";
import { listPaymentExceptions } from "@/server/payment-review";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageActor(true), raw = Number((await searchParams).page || 1);
  const result = await listPaymentExceptions(getDb(), actor, Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100000) : 1);
  return <Workspace name={actor.user.name || actor.user.email} admin><div className="admin-workspace"><AdminHeading title="Payment review queue" description={result.total+" payments need attention. Check the original merchant statement before resolving a charge."} back={{href:"/admin/payments",label:"Payment settings and history"}}/>
    <div className="admin-record-grid wide">{result.orders.map(order => <Link className="admin-record admin-review-queue-card" key={order.id} href={`/admin/payments/${order.id}`}>
      <h2>{order.application.job.title}</h2><p>{order.application.user.email}</p><p>{formatFee(order.amountMinor)} - {paymentLabel(order.status)}{order.reviewHold ? " - Checkout on hold" : ""}</p>
      <p>Application: {order.application.status}</p><p>{order.attempts[0]?.reviewReason}</p>
    </Link>)}{!result.orders.length && <p>No payments need review on this page.</p>}</div>
    <nav className="admin-pagination" aria-label="Payment review pages">{result.page > 1 && <Link href={`?page=${result.page - 1}`}>Previous</Link>}{result.page * 20 < result.total && <Link href={`?page=${result.page + 1}`}>Next</Link>}</nav>
  </div></Workspace>;
}
