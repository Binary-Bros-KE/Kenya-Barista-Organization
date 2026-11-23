import { randomUUID } from "node:crypto";
import type { Notification, OutboxEvent, Prisma, PrismaClient } from "../generated/prisma/client";
import { getEnv } from "../lib/env";
import { formatDeadline } from "../lib/job-format";
import { logEvent } from "../lib/logger";
import { applicationSubmittedEmail, jobPublishedEmail, jobSubmittedEmail, newApplicantEmail } from "./email-templates";
import { sendMail, type MailSender } from "./mail";
import { notificationScope } from "./notification-access";
import { paidSubmission } from "./submitted-application";

const LIMIT = 5, LEASE_MS = 120000, PAGE_SIZE = 100;
const activeApplications = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] as const;
const jobEvents = ["job.updated", "job.close", "job.archive", "job.publish", "job.reopen", "job.withdraw", "job.request_changes", "job.submit"];
type Context = { jobId: string; recruiterId: string; applicationId?: string; ownerId?: string; applicants: boolean; employers: boolean; admins: boolean; title: string; body: string; jobTitle: string };
type Database = Prisma.TransactionClient;
const backoff = (attempt: number) => Math.min(3600000, 60000 * 2 ** (attempt - 1));

async function contextFor(db: Database, event: OutboxEvent): Promise<Context | null> {
  if (event.kind === "payment.review_resolved") {
    const review = await db.paymentReview.findUnique({ where: { id: event.aggregateId }, include: { order: { include: { application: { include: { job: true } } } } } });
    if (!review) return null;
    const app = review.order.application;
    return { jobId: app.jobId, recruiterId: app.job.recruiterId, applicationId: app.id, ownerId: app.userId, jobTitle: app.job.title,
      applicants: false, employers: false, admins: false, title: "Payment review updated",
      body: "An administrator has reviewed your application payment. Sign in to see the current payment and application status." };
  }
  if (event.kind === "payment.reversed") {
    const refund = await db.refundRecord.findUnique({ where: { id: event.aggregateId }, include: { order: { include: { application: { include: { job: true } } } } } });
    if (!refund || refund.status !== "COMPLETED") return null;
    const app = refund.order.application;
    return { jobId: app.jobId, recruiterId: app.job.recruiterId, applicationId: app.id, ownerId: app.userId, jobTitle: app.job.title,
      applicants: false, employers: false, admins: false, title: "Payment reversal recorded",
      body: "An administrator has recorded a manual reversal of your application payment. Sign in and view your payments for the reference." };
  }
  if (jobEvents.includes(event.kind)) {
    const job = await db.job.findUnique({ where: { id: event.aggregateId }, include: { recruiter: { select: { status: true } } } });
    if (!job) return null;
    const review = event.kind === "job.submit", changes = event.kind === "job.request_changes";
    if (review && job.status !== "PENDING_REVIEW" || changes && job.status !== "CHANGES_REQUESTED") return null;
    return { jobId: job.id, recruiterId: job.recruiterId, jobTitle: job.title, applicants: !["job.submit", "job.request_changes", "job.withdraw"].includes(event.kind),
      employers: job.recruiter.status === "ACTIVE", admins: review && job.recruiter.status === "ACTIVE",
      title: review ? "Job review requested" : changes ? "Changes requested for a job posting" : "Job posting updated",
      body: "A job posting has an update. Sign in to see its current details." };
  }
  let appId = event.aggregateId;
  if (event.kind === "application.response") {
    const response = await db.applicationResponse.findUnique({ where: { id: event.aggregateId }, select: { applicationId: true, source: true } });
    if (!response || response.source === "APPLICANT") return null;
    appId = response.applicationId;
  } else if (!["application.submitted", "application.withdrawn"].includes(event.kind)) {
    throw new Error("UNSUPPORTED_EVENT");
  }
  const app = await db.application.findUnique({ where: { id: appId }, include: { paymentOrder: true, job: { include: { recruiter: { select: { status: true } } } } } });
  if (!app || app.status === "DRAFT" || !app.submittedAt || !app.paymentOrder?.paidAt || !["SUCCEEDED", "REFUNDED"].includes(app.paymentOrder.status)) return null;
  if (event.kind === "application.response" && app.status === "WITHDRAWN" || event.kind === "application.withdrawn" && app.status !== "WITHDRAWN") return null;
  return { jobId: app.jobId, recruiterId: app.job.recruiterId, applicationId: app.id, ownerId: app.userId, jobTitle: app.job.title, applicants: false,
    employers: event.kind !== "application.response" && app.job.recruiter.status === "ACTIVE" && (event.kind === "application.withdrawn" || app.status !== "WITHDRAWN"), admins: false,
    title: event.kind === "application.response" ? "New response to your application" : event.kind === "application.withdrawn" ? "Application withdrawn" : "Application received",
    body: event.kind === "application.response" ? "A recruitment response is available in your dashboard. Sign in to read it." : "Your application dashboard has an update. Sign in to view the details." };
}

// Recruiters and applicants get wording about their own job or application for the key moments;
// everyone else keeps the event's general wording.
function copyFor(kind: string, audience: string, context: Context) {
  const job = `"${context.jobTitle}"`;
  if (kind === "job.submit" && audience === "EMPLOYER") return { title: "Your job is in review", body: `${job} has been sent to KBO for review. We'll let you know when it's live.` };
  if (kind === "job.submit" && audience === "ADMIN") return { title: "Job review requested", body: `${job} is waiting for your review.` };
  if (kind === "job.publish" && audience === "EMPLOYER") return { title: "Your job is live", body: `${job} has been approved and is now open for applications.` };
  if (kind === "application.submitted" && audience === "APPLICANT") return { title: "Application received", body: `Your application for ${job} was submitted successfully.` };
  if (kind === "application.submitted" && audience === "EMPLOYER") return { title: "New applicant", body: `Someone has applied for ${job}. Sign in to review their application.` };
  return { title: context.title, body: context.body };
}

export async function expandNotificationEvent(db: PrismaClient, id: string) {
  const token = randomUUID(), now = new Date();
  const claimed = await db.outboxEvent.updateMany({ where: { id, processedAt: null, failedAt: null, availableAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS) } });
  if (!claimed.count) return false;
  try {
    await db.$transaction(async tx => {
      const event = await tx.outboxEvent.findFirst({ where: { id, leaseToken: token } });
      if (!event) return;
      const context = await contextFor(tx, event);
      if (!context) {
        await tx.outboxEvent.updateMany({ where: { id, leaseToken: token }, data: { processedAt: new Date(), leaseToken: null, leaseUntil: null, lastError: null } }); return;
      }
      const eligible: Prisma.UserWhereInput[] = [
        ...(context.ownerId ? [{ id: context.ownerId }] : []),
        ...(context.applicants ? [{ applications: { some: { jobId: context.jobId, status: { in: [...activeApplications] } } } }] : []),
        ...(context.employers ? [{ id: context.recruiterId, role: "RECRUITER" as const }] : []),
        ...(context.admins ? [{ role: "ADMIN" as const }] : []),
      ];
      const recipients = eligible.length ? await tx.user.findMany({ where: { status: "ACTIVE", emailVerified: true, ...(event.recipientCursor ? { id: { gt: event.recipientCursor } } : {}), OR: eligible },
        select: { id: true, role: true,
          applications: { where: { jobId: context.jobId }, select: { id: true, status: true }, take: 1 } }, orderBy: { id: "asc" }, take: PAGE_SIZE }) : [];
      for (const user of recipients) {
        const applicant = user.id === context.ownerId || context.applicants && user.applications.some(app => (activeApplications as readonly string[]).includes(app.status));
        const audience = applicant ? "APPLICANT" : context.admins && user.role === "ADMIN" ? "ADMIN" : "EMPLOYER";
        const applicationId = applicant ? context.applicationId || user.applications[0]?.id : context.applicationId;
        const href = audience === "APPLICANT" ? `/dashboard/applications/${encodeURIComponent(applicationId!)}` : audience === "ADMIN" ? `/admin/jobs/${encodeURIComponent(context.jobId)}` : context.applicationId ? `/employer/applications/${encodeURIComponent(context.applicationId)}` : `/employer/jobs/${encodeURIComponent(context.jobId)}`;
        await tx.notification.upsert({ where: { eventId_userId: { eventId: id, userId: user.id } }, update: {}, create: {
          eventId: id, userId: user.id, kind: event.kind, ...copyFor(event.kind, audience, context), href, audience, applicationId: applicationId || null, jobId: context.jobId,
        } });
      }
      await tx.outboxEvent.updateMany({ where: { id, leaseToken: token }, data: { recipientCursor: recipients.at(-1)?.id || event.recipientCursor,
        processedAt: recipients.length < PAGE_SIZE ? new Date() : null, attempts: 0, lastError: null, leaseToken: null, leaseUntil: null } });
    }, { timeout: 30000 });
    return true;
  } catch (error) {
    const event = await db.outboxEvent.findFirst({ where: { id, leaseToken: token } });
    if (event) {
      const attempts = event.attempts + 1;
      await db.outboxEvent.updateMany({ where: { id, leaseToken: token }, data: { attempts, failedAt: attempts >= LIMIT ? new Date() : null, availableAt: new Date(Date.now() + backoff(attempts)), lastError: error instanceof Error && error.message === "UNSUPPORTED_EVENT" ? "UNSUPPORTED_EVENT" : "EVENT_EXPANSION_FAILED", leaseToken: null, leaseUntil: null } });
    }
    return false;
  }
}

async function deliveryEligibility(db: PrismaClient, notification: Notification) {
  const user = await db.user.findUnique({ where: { id: notification.userId } });
  if (!user || user.status !== "ACTIVE" || !user.emailVerified) return { allowed: false as const, reason: "ACCOUNT_UNAVAILABLE" };
  if (!user.notificationEmails) return { allowed: false as const, reason: "EMAIL_DISABLED" };
  if (!await db.notification.findFirst({ where: { id: notification.id, ...notificationScope(user.id, user.role === "ADMIN") }, select: { id: true } })) return { allowed: false as const, reason: "ACCESS_REVOKED" };
  if (notification.eventId) {
    const event = await db.outboxEvent.findUnique({ where: { id: notification.eventId } });
    const context = event ? await contextFor(db, event) : null;
    if (!context || notification.audience === "EMPLOYER" && !context.employers || notification.audience === "ADMIN" && !context.admins || notification.audience === "APPLICANT" && context.ownerId !== user.id && !context.applicants) return { allowed: false as const, reason: "EVENT_NO_LONGER_RELEVANT" };
  }
  if (notification.kind.startsWith("job.") && notification.audience === "APPLICANT") {
    const app = notification.applicationId ? await db.application.findUnique({ where: { id: notification.applicationId }, select: { status: true } }) : null;
    if (!app || !(activeApplications as readonly string[]).includes(app.status)) return { allowed: false as const, reason: "EVENT_NO_LONGER_RELEVANT" };
  }
  return { allowed: true as const, email: user.email, name: user.name };
}

// The branded version of the key job and application emails, or null to send the plain notification text.
async function brandedEmail(db: PrismaClient, notification: Notification, name: string | null, baseUrl: string) {
  const { kind, audience, href } = notification;
  if (!notification.jobId) return null;
  const job = await db.job.findUnique({ where: { id: notification.jobId }, select: { title: true, slug: true, location: true, deadline: true, recruiter: { select: { name: true } } } });
  if (!job) return null;
  const facts = { baseUrl, name, href, jobTitle: job.title, location: job.location, deadline: formatDeadline(job.deadline) };
  if (kind === "job.submit" && audience === "EMPLOYER") return jobSubmittedEmail(facts);
  if (kind === "job.publish" && audience === "EMPLOYER") return jobPublishedEmail({ ...facts, publicHref: `/jobs/${encodeURIComponent(job.slug)}` });
  if (kind !== "application.submitted" || !notification.applicationId) return null;
  const app = await db.application.findUnique({ where: { id: notification.applicationId }, select: { submittedAt: true, user: { select: { name: true } } } });
  if (!app?.submittedAt) return null;
  if (audience === "APPLICANT") return applicationSubmittedEmail({ baseUrl, name, href, jobTitle: job.title, employer: job.recruiter.name || "KBO recruiter", location: job.location, submittedAt: formatDeadline(app.submittedAt) });
  if (audience === "EMPLOYER") return newApplicantEmail({ baseUrl, name, href, jobTitle: job.title, applicant: app.user.name || "A job seeker",
    applicants: await db.application.count({ where: { jobId: notification.jobId, ...paidSubmission } }) });
  return null;
}

export async function deliverNotification(db: PrismaClient, id: string, deliver: MailSender = sendMail) {
  const token = randomUUID(), now = new Date();
  const claimed = await db.notification.updateMany({ where: { id, deliveryStatus: "PENDING", attempts: { lt: LIMIT }, availableAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: { attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS) } });
  if (!claimed.count) return false;
  try {
    const notification = await db.notification.findFirstOrThrow({ where: { id, leaseToken: token } });
    const eligibility = await deliveryEligibility(db, notification);
    if (!eligibility.allowed) {
      await db.notification.updateMany({ where: { id, leaseToken: token }, data: { deliveryStatus: "SKIPPED", lastError: eligibility.reason, leaseToken: null, leaseUntil: null } }); return true;
    }
    const base = new URL(getEnv().APP_URL), link = new URL(notification.href, base);
    if (link.origin !== base.origin || !notification.href.startsWith("/") || notification.href.startsWith("//")) throw new Error("INVALID_NOTIFICATION_LINK");
    const branded = await brandedEmail(db, notification, eligibility.name, base.origin);
    await deliver({ to: eligibility.email, messageId: `<notification-${notification.id}@${base.hostname}>`,
      ...(branded ?? { subject: `KBO: ${notification.title}`, text: `${notification.body}\n\n${link.toString()}\n\nManage job and application email preferences in your notification dashboard.` }) });
    await db.notification.updateMany({ where: { id, leaseToken: token }, data: { deliveryStatus: "SENT", sentAt: new Date(), lastError: null, leaseToken: null, leaseUntil: null } });
    return true;
  } catch {
    const item = await db.notification.findFirst({ where: { id, leaseToken: token } });
    if (item) await db.notification.updateMany({ where: { id, leaseToken: token }, data: { deliveryStatus: item.attempts >= LIMIT ? "FAILED" : "PENDING", availableAt: new Date(Date.now() + backoff(item.attempts)), lastError: "EMAIL_DELIVERY_FAILED", leaseToken: null, leaseUntil: null } });
    return false;
  }
}

export async function runNotificationWorker(db: PrismaClient, deliver: MailSender = sendMail) {
  // A worker that dies on its last delivery attempt must not leave a permanently pending row.
  await db.notification.updateMany({ where: { deliveryStatus: "PENDING", attempts: { gte: LIMIT }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { deliveryStatus: "FAILED", lastError: "ATTEMPT_LIMIT", leaseToken: null, leaseUntil: null } });
  const events = await db.outboxEvent.findMany({ where: { processedAt: null, failedAt: null, availableAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, select: { id: true }, orderBy: [{ availableAt: "asc" }, { id: "asc" }], take: 20 });
  let eventsProcessed = 0, deliveriesProcessed = 0;
  for (const event of events) if (await expandNotificationEvent(db, event.id)) eventsProcessed++;
  const deliveries = await db.notification.findMany({ where: { deliveryStatus: "PENDING", attempts: { lt: LIMIT }, availableAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, select: { id: true }, orderBy: [{ availableAt: "asc" }, { id: "asc" }], take: 25 });
  for (const item of deliveries) if (await deliverNotification(db, item.id, deliver)) deliveriesProcessed++;
  return { eventsConsidered: events.length, eventsProcessed, deliveriesConsidered: deliveries.length, deliveriesProcessed };
}

// Runs one worker pass right after a request saves an event, so its emails go out within seconds
// instead of waiting for the background worker. Leases stop the two from sending anything twice,
// and anything that fails here stays queued for the background worker to retry.
export async function sendNotificationsNow(db: PrismaClient) {
  try { await runNotificationWorker(db); }
  catch { logEvent("warn", "notifications.immediate_pass_failed"); }
}
