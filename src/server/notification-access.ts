import { z } from "zod";
import type { PrismaClient, Prisma } from "../generated/prisma/client";
import type { Actor } from "./access";
import { assertAdmin } from "./access";
import { AccessError } from "./errors";
import { paidSubmission } from "./submitted-application";

export function notificationScope(userId: string, admin: boolean): Prisma.NotificationWhereInput {
  return { userId, OR: [
    { audience: "APPLICANT", application: { is: { userId } } },
    { audience: "EMPLOYER", job: { is: { organisation: { suspendedAt: null, members: { some: { userId } } } } },
      OR: [{ applicationId: null }, { application: { is: paidSubmission } }] },
    ...(admin ? [{ audience: "ADMIN" }] : []),
  ] };
}
export async function listNotifications(db: PrismaClient, actor: Actor, input: unknown) {
  const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), unread: z.enum(["true", "false"]).default("false") }).strict().parse(input);
  const admin = actor.user.role === "ADMIN" && actor.user.twoFactorEnabled && !!actor.session.mfaVerifiedAt;
  const scope = notificationScope(actor.user.id, admin), where = { ...scope, ...(query.unread === "true" ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * 20, take: 20 }),
    db.notification.count({ where }), db.notification.count({ where: { ...scope, readAt: null } }),
  ]);
  return { notifications: items, unread, pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
}
export async function markNotificationRead(db: PrismaClient, actor: Actor, id: string) {
  const admin = actor.user.role === "ADMIN" && actor.user.twoFactorEnabled && !!actor.session.mfaVerifiedAt;
  const where = { id, ...notificationScope(actor.user.id, admin) };
  if (!await db.notification.findFirst({ where, select: { id: true } })) throw new AccessError(404, "NOT_FOUND", "Notification not found");
  await db.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
  return { read: true };
}
export async function saveNotificationPreference(db: PrismaClient, actor: Actor, input: unknown) {
  const { emailEnabled } = z.object({ emailEnabled: z.boolean() }).strict().parse(input);
  await db.user.update({ where: { id: actor.user.id }, data: { notificationEmails: emailEnabled } });
  return { emailEnabled };
}
export async function retryNotificationWork(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = z.object({ target: z.enum(["event", "delivery"]), id: z.string().min(1).max(100) }).strict().parse(input);
  return db.$transaction(async tx => {
    const changed = data.target === "event"
      ? await tx.outboxEvent.updateMany({ where: { id: data.id, failedAt: { not: null }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { failedAt: null, attempts: 0, lastError: null, availableAt: new Date(), leaseToken: null, leaseUntil: null } })
      : await tx.notification.updateMany({ where: { id: data.id, deliveryStatus: "FAILED", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { deliveryStatus: "PENDING", attempts: 0, lastError: null, availableAt: new Date(), leaseToken: null, leaseUntil: null } });
    if (!changed.count) throw new AccessError(409, "NOT_RETRYABLE", "Only failed, inactive queue items can be retried");
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: `notifications.${data.target}_retry_requested`, entityType: data.target === "event" ? "OutboxEvent" : "Notification", entityId: data.id } });
    return { queued: true };
  });
}
export async function notificationOperations(db: PrismaClient, actor: Actor) {
  assertAdmin(actor);
  const [eventsPending, eventsFailed, deliveriesPending, deliveriesFailed, sent, skipped, oldestPending, events, deliveries] = await Promise.all([
    db.outboxEvent.count({ where: { processedAt: null, failedAt: null } }), db.outboxEvent.count({ where: { failedAt: { not: null } } }),
    db.notification.count({ where: { deliveryStatus: "PENDING" } }), db.notification.count({ where: { deliveryStatus: "FAILED" } }),
    db.notification.count({ where: { deliveryStatus: "SENT" } }), db.notification.count({ where: { deliveryStatus: "SKIPPED" } }),
    db.outboxEvent.findFirst({ where: { processedAt: null, failedAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.outboxEvent.findMany({ where: { failedAt: { not: null } }, select: { id: true, kind: true, attempts: true, lastError: true }, orderBy: { failedAt: "desc" }, take: 50 }),
    db.notification.findMany({ where: { deliveryStatus: "FAILED" }, select: { id: true, kind: true, attempts: true, lastError: true, user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { counts: { eventsPending, eventsFailed, deliveriesPending, deliveriesFailed, sent, skipped }, oldestPendingAt: oldestPending?.createdAt || null, events, deliveries };
}
