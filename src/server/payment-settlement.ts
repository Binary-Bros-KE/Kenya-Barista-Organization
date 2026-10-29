import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { profileInput } from "./applications";

const snapshotInput = profileInput.extend({ email: z.email(), coverLetter: z.string().max(6000), documentId: z.string().min(1),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/), jobTitle: z.string().min(1), organisationName: z.string().min(1),
  jobVersion: z.number().int().positive(), applicationVersion: z.number().int().positive() });

export async function lockPaymentOrder(tx: Prisma.TransactionClient, orderId: string) {
  const scope = await tx.paymentOrder.findUnique({ where: { id: orderId }, select: { applicationId: true, application: { select: { userId: true } } } });
  if (!scope) return false;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${scope.application.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${scope.applicationId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "PaymentOrder" WHERE "id" = ${orderId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = (SELECT "jobId" FROM "Application" WHERE "id" = ${scope.applicationId}) FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = (SELECT "organisationId" FROM "Job" WHERE "id" = (SELECT "jobId" FROM "Application" WHERE "id" = ${scope.applicationId})) FOR SHARE`;
  return true;
}

// Caller holds User -> Application -> PaymentOrder -> Job/Organisation locks and
// has independently verified the receipt. Manual and provider settlement use the same rules.
export async function settlePayment(tx: Prisma.TransactionClient, attemptId: string, receipt: string, source: "PROVIDER" | "STATEMENT", actorId: string) {
  const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { configuration: { select: { environment: true } }, paymentOrder: { include: {
    attempts: { select: { id: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    application: { include: { job: { include: { organisation: true } }, user: true, documents: { include: { document: true } } } },
  } } } });
  const order = attempt.paymentOrder, app = order.application;
  const parsed = snapshotInput.safeParse(order.frozenSnapshot), snapshot = parsed.success ? parsed.data : null;
  const document = app.documents.length === 1 ? app.documents[0].document : null;
  const latest = order.attempts[0]?.id === attemptId;
  const eligible = latest && !order.reviewHold && (process.env.NODE_ENV !== "production" || attempt.configuration?.environment === "LIVE") && app.status === "DRAFT" && app.user.status === "ACTIVE" && app.user.emailVerified
    && app.job.status === "PUBLISHED" && !!app.job.publishedAt && app.job.deadline > new Date() && !app.job.organisation.suspendedAt
    && app.applicationFeeMinor === order.amountMinor && app.currency === order.currency && order.currency === "KES"
    && !!snapshot && snapshot.jobVersion === app.job.version && snapshot.applicationVersion === app.version
    && document?.id === snapshot.documentId && document.userId === app.userId && document.scanStatus === "CLEAN" && document.sha256 === snapshot.documentSha256;
  await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: "SUCCEEDED", receiptNumber: receipt, ...(source === "PROVIDER" ? { resultCode: "0" } : {}), reviewReason: eligible ? null : "PAID_APPLICATION_UNAVAILABLE" } });
  await tx.paymentOrder.update({ where: { id: order.id }, data: { status: "SUCCEEDED", paidAt: order.paidAt || new Date(), version: { increment: 1 }, ...(!latest ? { reviewHold: true } : {}) } });
  if (eligible) {
    await tx.application.update({ where: { id: app.id }, data: { status: "SUBMITTED", submittedAt: new Date(), submissionSnapshot: snapshot, version: { increment: 1 } } });
    await tx.applicationStatusHistory.create({ data: { applicationId: app.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", message: source === "PROVIDER" ? "Application fee confirmed by M-Pesa" : "Application fee confirmed by administrator statement review" } });
    await tx.outboxEvent.upsert({ where: { deduplicationKey: `application:${app.id}:submitted` }, update: {}, create: { deduplicationKey: `application:${app.id}:submitted`, kind: "application.submitted", aggregateId: app.id } });
  }
  await tx.auditLog.create({ data: { actorId, action: eligible ? "payment.confirmed_application_submitted" : "payment.confirmed_requires_review", entityType: "PaymentOrder", entityId: order.id } });
  return { submitted: !!eligible };
}
