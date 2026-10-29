import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { openPaymentSecret } from "./payment-secrets";
import { lockPaymentOrder, settlePayment } from "./payment-settlement";

// Build time-sensitive filters per request rather than at module load.
export function paymentExceptionWhere(): Prisma.PaymentOrderWhereInput {
  return { OR: [{ reviewHold: true }, { status: "NEEDS_REVIEW" }, { status: "PENDING", attempts: { some: { status: "PENDING", createdAt: { lte: new Date(Date.now() - 600000) } } } }, { status: "SUCCEEDED", application: { status: "DRAFT" } }] };
}
export async function listPaymentExceptions(db: PrismaClient, actor: Actor, page = 1) {
  assertAdmin(actor);
  page = z.number().int().min(1).max(100000).parse(page);
  const where = paymentExceptionWhere();
  const [orders, total] = await Promise.all([db.paymentOrder.findMany({ where, select: {
    id: true, version: true, status: true, reviewHold: true, amountMinor: true, createdAt: true,
    application: { select: { id: true, status: true, user: { select: { email: true } }, job: { select: { title: true } } } },
    attempts: { select: { reviewReason: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
  }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }), db.paymentOrder.count({ where })]);
  return { orders, total, page };
}
export async function paymentReviewDetail(db: PrismaClient, actor: Actor, id: string) {
  assertAdmin(actor);
  const order = await db.paymentOrder.findUnique({ where: { id }, select: {
    id: true, version: true, status: true, reviewHold: true, amountMinor: true, currency: true, paidAt: true,
    application: { select: { id: true, status: true, user: { select: { email: true } }, job: { select: { title: true } } } },
    attempts: { select: { id: true, status: true, createdAt: true, updatedAt: true, receiptNumber: true, reviewReason: true, resultCode: true, checkoutRequestId: true,
      configuration: { select: { kind: true, label: true, environment: true, businessShortCode: true, tillNumber: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
    reviews: { select: { id: true, action: true, note: true, evidenceReference: true, createdAt: true, actor: { select: { email: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 },
  } });
  if (!order) throw new AccessError(404, "NOT_FOUND", "Payment not found");
  return order;
}

const common = z.object({ version: z.number().int().positive(), attemptId: z.string().min(1).max(100), note: z.string().trim().min(10).max(2000) });
const statement = common.extend({ evidenceReference: z.string().trim().min(5).max(150), statementChecked: z.literal(true) });
export const reviewInput = z.discriminatedUnion("action", [
  common.extend({ action: z.literal("NOTE") }).strict(),
  statement.extend({ action: z.literal("NOT_CHARGED") }).strict(),
  statement.extend({ action: z.literal("RETRY_SUBMISSION") }).strict(),
  statement.extend({ action: z.literal("CONFIRM_RECEIPT"), receipt: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{10,20}$/),
    amountMinor: z.number().int().positive(), phone: z.string().regex(/^\+?254[17]\d{8}$/).transform(value => value.replace(/^\+/, "")), merchant: z.string().regex(/^\d{5,10}$/) }).strict(),
]);

export async function resolvePaymentException(db: PrismaClient, actor: Actor, orderId: string, input: unknown) {
  assertAdmin(actor);
  const data = reviewInput.parse(input);
  return db.$transaction(async tx => {
    if (!await lockPaymentOrder(tx, orderId)) throw new AccessError(404, "NOT_FOUND", "Payment not found");
    const order = await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId }, include: { application: true, attempts: { include: { configuration: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] } } });
    if (order.version !== data.version) throw new AccessError(409, "STALE_PAYMENT", "This payment changed. Reload before reviewing it");
    const attempt = order.attempts.find(item => item.id === data.attemptId);
    if (!attempt) throw new AccessError(404, "NOT_FOUND", "Payment attempt not found");
    let submitted = false;
    if (data.action !== "NOTE") {
      if (attempt.queryLeaseUntil && attempt.queryLeaseUntil > new Date()) throw new AccessError(409, "PAYMENT_CHECK_RUNNING", "A provider check is running. Wait a minute and reload");
      if (order.attempts.some(item => item.id !== attempt.id && ["PENDING", "NEEDS_REVIEW"].includes(item.status))) throw new AccessError(409, "OTHER_ATTEMPT_UNRESOLVED", "Another payment attempt still needs resolution");
      if (data.action === "NOT_CHARGED") {
        if (order.paidAt || order.attempts[0]?.id !== attempt.id || !["PENDING", "NEEDS_REVIEW"].includes(attempt.status)
          || attempt.receiptNumber || attempt.evidenceCipher || attempt.resultCode === "0" || attempt.createdAt.getTime() > Date.now() - 600000) {
          throw new AccessError(409, "UNSAFE_RETRY", "Only an aged, unresolved latest request without success evidence can be cleared after checking the statement");
        }
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", reviewReason: "STATEMENT_NOT_CHARGED" } });
        const olderEvidence = order.attempts.some(item => item.id !== attempt.id && !!item.evidenceCipher && ["FAILED", "CANCELLED"].includes(item.status));
        await tx.paymentOrder.update({ where: { id: orderId }, data: { status: "FAILED", reviewHold: olderEvidence, version: { increment: 1 } } });
      } else if (data.action === "CONFIRM_RECEIPT") {
        if (["SUCCEEDED", "REFUNDED"].includes(attempt.status) || order.status === "REFUNDED") throw new AccessError(409, "ALREADY_SETTLED", "This charge is already settled or reversed");
        const config = attempt.configuration;
        if (process.env.NODE_ENV === "production" && config?.environment !== "LIVE") throw new AccessError(409, "SANDBOX_PAYMENT", "Sandbox charges cannot confirm production application payments");
        const payer = attempt.payerCipher ? openPaymentSecret<{ phone: string }>(attempt.payerCipher, `payer:${attempt.id}`) : null;
        if (!config || !payer || payer.phone !== data.phone || data.amountMinor !== order.amountMinor
          || data.merchant !== (config.kind === "TILL" ? config.tillNumber : config.businessShortCode)) throw new AccessError(400, "STATEMENT_MISMATCH", "Statement amount, payer, or original merchant does not match");
        if (attempt.evidenceCipher && openPaymentSecret<{ receipt: string }>(attempt.evidenceCipher, `evidence:${attempt.id}`).receipt !== data.receipt) throw new AccessError(409, "RECEIPT_CONFLICT", "The statement receipt conflicts with callback evidence");
        if (await tx.paymentAttempt.findFirst({ where: { receiptNumber: data.receipt, id: { not: attempt.id } } })) throw new AccessError(409, "DUPLICATE_RECEIPT", "This receipt is already linked to another charge");
        // Clear a late-evidence hold only when this is the original latest attempt,
        // with no other settled charge. Older receipts never submit a newer snapshot.
        if (order.attempts[0]?.id === attempt.id && !order.paidAt) await tx.paymentOrder.update({ where: { id: orderId }, data: { reviewHold: false } });
        ({ submitted } = await settlePayment(tx, attempt.id, data.receipt, "STATEMENT", actor.user.id));
      } else {
        if (order.status !== "SUCCEEDED" || !order.paidAt || attempt.status !== "SUCCEEDED" || !attempt.receiptNumber || order.application.status !== "DRAFT" || order.reviewHold || order.attempts[0]?.id !== attempt.id) throw new AccessError(409, "SUBMISSION_UNAVAILABLE", "This payment cannot retry its original submission");
        ({ submitted } = await settlePayment(tx, attempt.id, attempt.receiptNumber, "STATEMENT", actor.user.id));
        if (!submitted) throw new AccessError(409, "APPLICATION_UNAVAILABLE", "The original frozen application is still ineligible. Do not charge again; contact the applicant or record a completed manual reversal");
      }
    } else await tx.paymentOrder.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    const review = await tx.paymentReview.create({ data: { paymentOrderId: orderId, paymentAttemptId: attempt.id, actorId: actor.user.id,
      action: data.action, note: data.note, evidenceReference: "evidenceReference" in data ? data.evidenceReference : null } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: `payment.review.${data.action.toLowerCase()}`, entityType: "PaymentOrder", entityId: orderId } });
    if (data.action !== "NOTE") await tx.outboxEvent.create({ data: { kind: "payment.review_resolved", aggregateId: review.id, deduplicationKey: `payment-review:${review.id}` } });
    return { id: review.id, submitted };
  }, { timeout: 15000 });
}
