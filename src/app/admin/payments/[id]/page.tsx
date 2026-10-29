import { paymentLabel } from "@/lib/payment-view";
import { formatDeadline } from "@/lib/job-format";
import { AdminHeading } from "@/components/admin-ui";
import { notFound } from "next/navigation";
import { pageActor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { Workspace } from "@/components/workspace";
import { PaymentReviewForm } from "@/components/payment-review-form";
import { PaymentRecheck } from "@/components/payment-recheck";
import { ManualReversal } from "@/components/manual-reversal";
import { paymentReviewDetail } from "@/server/payment-review";
import { AccessError } from "@/server/errors";
import { formatFee } from "@/lib/job-format";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(true); let order;
  try { order = await paymentReviewDetail(getDb(), actor, (await params).id); } catch (error) { if (error instanceof AccessError && error.status === 404) notFound(); throw error; }
  return <Workspace name={actor.user.name || actor.user.email} admin><div className="admin-workspace"><AdminHeading title={order.application.job.title} description={order.application.user.email} back={{href:"/admin/payments/review",label:"Payment review queue"}}/><div className="admin-payment-summary"><strong>{formatFee(order.amountMinor)}</strong><span className="admin-badge">{paymentLabel(order.status)}</span><span>Application: {order.application.status.replaceAll("_"," ")}</span></div><p className="admin-reference">Application reference: {order.application.id}</p>
 {order.reviewHold&&<p className="admin-feedback is-warning">Checkout is held because payment evidence needs review. Confirm the correct receipt before taking further action.</p>}{["PENDING","NEEDS_REVIEW"].includes(order.status)&&<PaymentRecheck orderId={order.id}/>}
 <div className="admin-payment-detail-grid"><section className="admin-payment-attempts"><div className="admin-section-heading"><h2>Attempts & original merchants</h2><p>Verify evidence against the merchant that received the original request.</p></div>{order.attempts.map(attempt=><article className="admin-record" key={attempt.id}><header><span className="admin-badge">{paymentLabel(attempt.status)}</span><time dateTime={attempt.createdAt.toISOString()}>{formatDeadline(attempt.createdAt)}</time></header><p className="admin-reference">{attempt.id}</p><dl className="admin-detail-facts"><div><dt>M-Pesa receipt</dt><dd>{attempt.receiptNumber||"No confirmed receipt"}</dd></div><div><dt>Provider result</dt><dd>{attempt.resultCode||"Unknown"}</dd></div><div><dt>Original configuration</dt><dd>{attempt.configuration?.label||"Unavailable"} - {attempt.configuration?.environment||"Unknown environment"}</dd></div><div><dt>Receiving merchant</dt><dd>{attempt.configuration?.kind==="TILL"?"Till "+attempt.configuration.tillNumber+", shortcode "+attempt.configuration.businessShortCode:"Paybill "+(attempt.configuration?.businessShortCode||"Unavailable")}</dd></div>{attempt.reviewReason&&<div><dt>Review reason</dt><dd>{attempt.reviewReason}</dd></div>}</dl>{order.status==="SUCCEEDED"&&attempt.status==="SUCCEEDED"&&<details className="admin-operation-disclosure"><summary>Record a completed manual reversal</summary><ManualReversal orderId={order.id} attemptId={attempt.id}/></details>}</article>)}{!order.attempts.length&&<p className="admin-empty">No payment attempts are recorded.</p>}</section><PaymentReviewForm key={order.version} orderId={order.id} version={order.version} attempts={order.attempts}/></div>
 <section className="admin-panel admin-review-history"><div className="admin-section-heading"><h2>Private review history</h2><p>Latest 100 entries. Earlier entries remain in the audit database. Times use Nairobi time.</p></div>{order.reviews.map(review=><article key={review.id}><header><h3>{review.action.replaceAll("_"," ")}</h3><time dateTime={review.createdAt.toISOString()}>{formatDeadline(review.createdAt)}</time></header><p className="admin-help">{review.actor?.email||"System"}</p><p className="admin-review-note">{review.note}</p><p className="admin-reference">Evidence: {review.evidenceReference||"None"}</p></article>)}{!order.reviews.length&&<p className="admin-empty">No review decisions recorded yet.</p>}</section></div></Workspace>;
}
