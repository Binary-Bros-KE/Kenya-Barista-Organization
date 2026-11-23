import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { logEvent } from "../lib/logger";
import { partnerRequestEmail } from "./email-templates";
import { defaultMail, type MailSettings } from "./instant-email";

// Organisations ask to partner with KBO from the public site; administrators follow them up
// from the Partner requests tab. Each request emails KBO's notification address.

export const partnershipKinds = {
  SPONSORSHIP: "Sponsorship or events", TRAINING: "Training and education", SUPPLIER: "Supplying coffee, milk or equipment",
  HIRING: "Hiring baristas", MEDIA: "Media and community", OTHER: "Something else",
} as const;
type Kind = keyof typeof partnershipKinds;
const MAX_PER_HOUR = 3;

const optional = (max: number) => z.string().trim().max(max).optional().transform(value => value || null);
export const partnerRequestInput = z.object({
  organisation: z.string().trim().min(2, "Enter your organisation's name").max(160),
  contactName: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  phone: optional(30).refine(value => !value || /^\+?[\d\s()-]{7,20}$/.test(value), "Enter a valid phone number"),
  website: optional(200).refine(value => !value || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value), "Enter a website or social media link, e.g. instagram.com/yourcafe"),
  kind: z.enum(Object.keys(partnershipKinds) as [Kind, ...Kind[]], "Choose what you'd like to partner on"),
  message: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(2000),
  // Hidden from people; bots that fill in every field give themselves away.
  nickname: z.string().max(200).optional(),
}).strict();

export const hashIp = (ip: string) => createHash("sha256").update(`partner-request:${ip}`).digest("hex");

// Saves the request and returns its id, or null for a bot (which is told it worked, so it doesn't retry).
export async function submitPartnerRequest(db: PrismaClient, input: unknown, ip: string) {
  const { nickname, ...data } = partnerRequestInput.parse(input);
  if (nickname) { logEvent("info", "partner_request.honeypot"); return null; }
  const ipHash = hashIp(ip);
  const recent = await db.partnerRequest.count({ where: { ipHash, createdAt: { gt: new Date(Date.now() - 3600000) } } });
  if (recent >= MAX_PER_HOUR) throw new AccessError(429, "TOO_MANY_REQUESTS", "We've already received several requests from you. Please try again in an hour, or email us.");
  const request = await db.partnerRequest.create({ data: { ...data, ipHash }, select: { id: true } });
  return request.id;
}

// Emails the request to the notification address, or every active administrator when none is set.
// Runs after the response; a failure is logged and the request still waits in the admin tab.
export async function emailPartnerRequest(db: PrismaClient, id: string, mail: MailSettings = defaultMail()) {
  try {
    const [request, settings] = await Promise.all([db.partnerRequest.findUnique({ where: { id } }), db.platformSettings.findUnique({ where: { id: "platform" }, select: { adminNotificationEmail: true } })]);
    if (!request || request.notifiedAt) return;
    const recipients = settings?.adminNotificationEmail ? [settings.adminNotificationEmail]
      : (await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE", emailVerified: true }, select: { email: true } })).map(user => user.email);
    if (!recipients.length) { logEvent("warn", "partner_request.no_recipient"); return; }
    const email = partnerRequestEmail({ baseUrl: mail.baseURL, ...request, kind: partnershipKinds[request.kind as Kind] ?? request.kind });
    for (const to of recipients) await mail.deliver({ to, ...email, messageId: `<partner-request-${request.id}-${hashIp(to).slice(0, 8)}@${new URL(mail.baseURL).hostname}>` });
    await db.partnerRequest.update({ where: { id }, data: { notifiedAt: new Date() } });
  } catch { logEvent("warn", "partner_request.email_failed"); }
}

const statuses = ["NEW", "CONTACTED", "ARCHIVED"] as const;
export async function listPartnerRequests(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const query = z.object({ status: z.enum(statuses).default("NEW"), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(input);
  const [requests, total, grouped, settings] = await Promise.all([
    db.partnerRequest.findMany({ where: { status: query.status }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * 20, take: 20,
      select: { id: true, organisation: true, contactName: true, email: true, phone: true, website: true, kind: true, message: true, status: true, notifiedAt: true, handledAt: true, createdAt: true, handledBy: { select: { name: true, email: true } } } }),
    db.partnerRequest.count({ where: { status: query.status } }),
    db.partnerRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.platformSettings.findUnique({ where: { id: "platform" }, select: { adminNotificationEmail: true } }),
  ]);
  const counts = Object.fromEntries(statuses.map(status => [status, grouped.find(row => row.status === status)?._count._all ?? 0])) as Record<typeof statuses[number], number>;
  return { status: query.status, requests: requests.map(request => ({ ...request, kindLabel: partnershipKinds[request.kind as Kind] ?? request.kind })), counts,
    notificationEmail: settings?.adminNotificationEmail ?? null, pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
}

export async function setPartnerRequestStatus(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  assertAdmin(actor);
  const { status } = z.object({ status: z.enum(statuses) }).strict().parse(input);
  const result = await db.partnerRequest.updateMany({ where: { id }, data: { status, handledById: actor.user.id, handledAt: new Date() } });
  if (!result.count) throw new AccessError(404, "NOT_FOUND", "Partner request not found");
  await db.auditLog.create({ data: { actorId: actor.user.id, action: `partner_request.${status.toLowerCase()}`, entityType: "PartnerRequest", entityId: id } });
  return { id, status };
}

// The address admin alerts go to. Empty clears it, so alerts go to every active administrator.
export async function saveNotificationEmail(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { email } = z.object({ email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"))]) }).strict().parse(input);
  await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform", adminNotificationEmail: email || null }, update: { adminNotificationEmail: email || null } });
  await db.auditLog.create({ data: { actorId: actor.user.id, action: "settings.admin_notification_email_changed", entityType: "PlatformSettings", entityId: "platform" } });
  return { email: email || null };
}
