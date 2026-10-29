import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";

export const manualReversalInput = z.object({
  attemptId: z.string().min(1).max(100),
  reference: z.string().trim().min(5).max(100),
  note: z.string().trim().min(10).max(2000),
  confirmedReturnedToPayer: z.literal(true),
}).strict();

// Accounting only: the operator returns the money outside this application.
// There is deliberately no provider client or network operation here.
export async function recordManualReversal(db: PrismaClient, actor: Actor, orderId: string, input: unknown) {
  assertAdmin(actor);
  const data = manualReversalInput.parse(input);
  const scope = await db.paymentOrder.findUnique({ where: { id: orderId }, select: { applicationId: true, application: { select: { userId: true } } } });
  if (!scope) throw new AccessError(404, "NOT_FOUND", "Payment not found");
  return db.$transaction(async tx => {
    // Match checkout/reconciliation lock order to avoid deadlocks during a status check.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${scope.application.userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${scope.applicationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "PaymentOrder" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.paymentOrder.findUnique({ where: { id: orderId }, include: { attempts: true } });
    if (!order) throw new AccessError(404, "NOT_FOUND", "Payment not found");
    const attempt = order.attempts.find(item => item.id === data.attemptId);
    if (!attempt) throw new AccessError(404, "NOT_FOUND", "Payment attempt not found");
    const existing = await tx.refundRecord.findUnique({ where: { paymentAttemptId: attempt.id } });
    if (existing?.status === "COMPLETED") {
      if (existing.providerReference !== data.reference) throw new AccessError(409, "ALREADY_REVERSED", "This payment already has a different reversal reference");
      return { id: existing.id, status: "REVERSED" as const };
    }
    if (existing || order.status !== "SUCCEEDED" || !order.paidAt || attempt.status !== "SUCCEEDED" || !attempt.receiptNumber) {
      throw new AccessError(409, "PAYMENT_NOT_REVERSIBLE", "Only a confirmed payment without an existing refund workflow can be marked reversed");
    }
    if (order.attempts.some(item => ["PENDING", "NEEDS_REVIEW"].includes(item.status))) {
      throw new AccessError(409, "PAYMENT_UNRESOLVED", "Resolve outstanding payment attempts first");
    }
    const refund = await tx.refundRecord.create({ data: {
      paymentOrderId: order.id, paymentAttemptId: attempt.id,
      amountMinor: order.amountMinor, currency: order.currency, status: "COMPLETED",
      reason: data.note, requestedById: actor.user.id, reviewedById: actor.user.id,
      completedById: actor.user.id, providerReference: data.reference, completedAt: new Date(),
    } });
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "REFUNDED" } });
    const allReversed = order.attempts.every(item => item.id === attempt.id || (item.status !== "SUCCEEDED" && !(item.evidenceCipher && ["FAILED", "CANCELLED"].includes(item.status))));
    await tx.paymentOrder.update({ where: { id: order.id }, data: {
      ...(allReversed ? { status: "REFUNDED" as const, reviewHold: false } : {}), version: { increment: 1 },
    } });
    await tx.paymentReview.create({ data: {
      paymentOrderId: order.id, paymentAttemptId: attempt.id, refundId: refund.id,
      actorId: actor.user.id, action: "MANUAL_REVERSAL_RECORDED", note: data.note,
      evidenceReference: data.reference,
    } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "payment.manual_reversal_recorded", entityType: "PaymentOrder", entityId: order.id } });
    await tx.outboxEvent.create({ data: { kind: "payment.reversed", aggregateId: refund.id, deduplicationKey: `refund:${refund.id}:completed` } });
    return { id: refund.id, status: "REVERSED" as const };
  });
}
