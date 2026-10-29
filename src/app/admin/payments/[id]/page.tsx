import Link from "next/link";
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
  return <Workspace name={actor.user.name || actor.user.email} admin><Link href="/admin/payments/review">Payment review queue</Link>
    <h1 className="mt-5">{order.application.job.title}</h1><p>{order.application.user.email}</p><p>{formatFee(order.amountMinor)} - {order.status === "REFUNDED" ? "REVERSED" : order.status} - Application {order.application.status}</p>
    <p className="hint">Application reference: {order.application.id}</p>{order.reviewHold && <p className="notice error">Checkout is held because payment evidence needs review. Confirm the correct receipt before taking further action.</p>}
    {["PENDING", "NEEDS_REVIEW"].includes(order.status) && <PaymentRecheck orderId={order.id} />}
    <section className="mt-6 grid gap-4"><h2>Attempts and original merchants</h2>{order.attempts.map(attempt => <article className="card" key={attempt.id}><p className="break-all">{attempt.id}</p><p>{attempt.status} - {attempt.createdAt.toISOString()}</p><p>{attempt.receiptNumber || "No confirmed receipt"} - {attempt.reviewReason}</p><p>Provider result: {attempt.resultCode || "Unknown"}</p><p>{attempt.configuration?.label} ({attempt.configuration?.environment}) - {attempt.configuration?.kind === "TILL" ? `Till ${attempt.configuration.tillNumber}, shortcode ${attempt.configuration.businessShortCode}` : `Paybill ${attempt.configuration?.businessShortCode || "Unavailable"}`}</p>{order.status === "SUCCEEDED" && attempt.status === "SUCCEEDED" && <ManualReversal orderId={order.id} attemptId={attempt.id} />}</article>)}</section>
    <PaymentReviewForm key={order.version} orderId={order.id} version={order.version} attempts={order.attempts} />
    <section className="mt-8"><h2>Private review history</h2><p className="hint">Latest 100 entries. Earlier entries remain in the audit database.</p>{order.reviews.map(review => <article className="card mt-3" key={review.id}><p>{review.action} - {review.actor?.email || "System"} - {review.createdAt.toISOString()}</p><p className="whitespace-pre-wrap">{review.note}</p><p>Evidence: {review.evidenceReference || "None"}</p></article>)}</section>
  </Workspace>;
}
