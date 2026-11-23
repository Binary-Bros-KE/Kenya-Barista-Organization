import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { profileInput } from "./applications";
import { defaultMail, emailNow, notify, type MailSettings } from "./instant-email";
import { topUpConfirmedEmail, topUpReceivedEmail, topUpRejectedEmail } from "./email-templates";
import { formatDeadline, formatFee } from "../lib/job-format";

// The wallet. Members send money to KBO by M-Pesa and claim it here; an administrator checks the statement and
// confirms (crediting the wallet) or rejects the claim. Processed claims never change. Application fees can then be
// paid from the balance. Every balance change is written to WalletEntry with the user row locked.

export const TOP_UP_LIMITS = { minKes: 10, maxKes: 150000, pending: 3 };
const busyStatuses = ["PENDING", "NEEDS_REVIEW", "SUCCEEDED", "REFUNDED"];

export const topUpInput = z.object({
  amountKes: z.number().int("Enter a whole amount in KES").min(TOP_UP_LIMITS.minKes, `Top up at least KES ${TOP_UP_LIMITS.minKes}`).max(TOP_UP_LIMITS.maxKes, `Top up at most KES ${TOP_UP_LIMITS.maxKes.toLocaleString("en-KE")} at a time`),
  mpesaCode: z.string().trim().transform(value => value.toUpperCase().replace(/\s+/g, "")).pipe(z.string().regex(/^[A-Z0-9]{10}$/, "M-Pesa codes have 10 letters and numbers, e.g. TKL4AB12CD")),
  paidAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)),
}).strict();

const settingsInput = z.object({
  phone: z.string().trim().regex(/^(\+254|0)[17]\d{8}$/, "Enter a Kenyan number, e.g. 0712 345 678").transform(value => value.replace(/^\+254/, "0")),
  name: z.string().trim().min(2, "Enter the name M-Pesa shows for this number").max(80),
}).strict();

export async function topUpSettings(db: PrismaClient) {
  const settings = await db.platformSettings.findUnique({ where: { id: "platform" }, select: { topUpPhone: true, topUpName: true } });
  return { phone: settings?.topUpPhone ?? null, name: settings?.topUpName ?? null };
}

export async function saveTopUpSettings(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = settingsInput.parse(input);
  await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform", topUpPhone: data.phone, topUpName: data.name }, update: { topUpPhone: data.phone, topUpName: data.name } });
  await db.auditLog.create({ data: { actorId: actor.user.id, action: "wallet.top_up_number_changed", entityType: "PlatformSettings", entityId: "platform" } });
  return data;
}

// Balance, the M-Pesa details to pay, open claims and the full history (ledger entries plus claims) for the Wallet tab.
export async function walletSummary(db: PrismaClient, actor: Actor) {
  const [user, settings, entries, claims, totals] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: actor.user.id }, select: { walletBalanceMinor: true } }),
    topUpSettings(db),
    db.walletEntry.findMany({ where: { userId: actor.user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, kind: true, amountMinor: true, balanceAfterMinor: true, description: true, createdAt: true, topUp: { select: { mpesaCode: true } }, paymentOrder: { select: { applicationId: true } } } }),
    db.topUpRequest.findMany({ where: { userId: actor.user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, amountMinor: true, creditedMinor: true, mpesaCode: true, paidAt: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true } }),
    db.walletEntry.groupBy({ by: ["kind"], where: { userId: actor.user.id }, _sum: { amountMinor: true } }),
  ]);
  const sum = (kind: string) => Math.abs(totals.find(row => row.kind === kind)?._sum.amountMinor ?? 0);
  return {
    balanceMinor: user.walletBalanceMinor, settings, entries, claims,
    stats: { toppedUpMinor: sum("TOP_UP"), spentMinor: sum("APPLICATION_FEE"), pendingMinor: claims.filter(claim => claim.status === "PENDING").reduce((total, claim) => total + claim.amountMinor, 0) },
    limits: TOP_UP_LIMITS,
  };
}

export async function walletBalance(db: PrismaClient, actor: Actor) {
  return (await db.user.findUniqueOrThrow({ where: { id: actor.user.id }, select: { walletBalanceMinor: true } })).walletBalanceMinor;
}

const facts = (claim: { amountMinor: number; mpesaCode: string; paidAt: Date }, amountMinor = claim.amountMinor) => ({ amount: formatFee(amountMinor), code: claim.mpesaCode, paidAt: formatDeadline(claim.paidAt) });

export async function submitTopUp(db: PrismaClient, actor: Actor, input: unknown, mail: MailSettings = defaultMail()) {
  const data = topUpInput.parse(input);
  const now = Date.now();
  if (data.paidAt.getTime() > now + 5 * 60000) throw new AccessError(400, "PAID_IN_FUTURE", "The payment time can't be in the future");
  if (data.paidAt.getTime() < now - 30 * 86400000) throw new AccessError(400, "PAID_TOO_LONG_AGO", "That payment is more than 30 days old. Contact KBO to sort it out.");
  if ((await topUpSettings(db)).phone === null) throw new AccessError(409, "TOP_UPS_UNAVAILABLE", "Top-ups aren't set up yet. Please try again later.");
  try {
    const { claim, receiptId } = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
      if (await tx.topUpRequest.count({ where: { userId: actor.user.id, status: "PENDING" } }) >= TOP_UP_LIMITS.pending) throw new AccessError(409, "TOO_MANY_PENDING", `You have ${TOP_UP_LIMITS.pending} top-ups waiting to be confirmed. Please wait for those first.`);
      const claim = await tx.topUpRequest.create({ data: { userId: actor.user.id, amountMinor: data.amountKes * 100, mpesaCode: data.mpesaCode, paidAt: data.paidAt } });
      await tx.auditLog.create({ data: { actorId: actor.user.id, action: "wallet.top_up_claimed", entityType: "TopUpRequest", entityId: claim.id } });
      const who = actor.user.name || actor.user.email;
      for (const admin of await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } }))
        await notify(tx, { userId: admin.id, kind: "wallet.top_up_claimed", audience: "ADMIN", title: "Top-up to confirm", body: `${who} says they sent ${formatFee(claim.amountMinor)} by M-Pesa (code ${claim.mpesaCode}).`, href: "/admin/wallet" });
      const receipt = await notify(tx, { userId: actor.user.id, kind: "wallet.top_up_received", audience: "ACCOUNT", title: "Top-up received", body: `We're checking your ${formatFee(claim.amountMinor)} top-up (M-Pesa ${claim.mpesaCode}).`, href: "/dashboard/wallet" });
      return { claim, receiptId: receipt.id };
    });
    await emailNow(db, receiptId, actor.user.email, topUpReceivedEmail({ baseUrl: mail.baseURL, name: actor.user.name, ...facts(claim) }), mail);
    return claim;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new AccessError(409, "CODE_ALREADY_USED", "This M-Pesa code has already been submitted. Each payment can only be claimed once.");
    throw error;
  }
}

const reviewInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("confirm"), creditedKes: z.number().int().min(1).max(TOP_UP_LIMITS.maxKes), note: z.string().trim().max(500).optional() }).strict(),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(5, "Tell the member why, e.g. the code isn't on the statement").max(500) }).strict(),
]);

export async function listTopUps(db: PrismaClient, actor: Actor, input: { status?: string; page?: string } = {}) {
  assertAdmin(actor);
  const status = z.enum(["PENDING", "CONFIRMED", "REJECTED"]).catch("PENDING").parse(input.status);
  const page = Math.max(1, Math.min(100000, Number.parseInt(input.page || "1", 10) || 1));
  const where: Prisma.TopUpRequestWhereInput = { status };
  const [total, claims, counts, settings, credited] = await Promise.all([
    db.topUpRequest.count({ where }),
    db.topUpRequest.findMany({ where, orderBy: status === "PENDING" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ reviewedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 30,
      select: { id: true, amountMinor: true, creditedMinor: true, mpesaCode: true, paidAt: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true,
        user: { select: { id: true, name: true, email: true, avatarVersion: true, walletBalanceMinor: true, role: true } }, reviewedBy: { select: { name: true, email: true } } } }),
    db.topUpRequest.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountMinor: true } }),
    topUpSettings(db),
    db.walletEntry.aggregate({ where: { kind: "TOP_UP" }, _sum: { amountMinor: true } }),
  ]);
  const count = (key: string) => counts.find(row => row.status === key);
  return {
    status, claims, settings, pagination: { page, total, pageCount: Math.ceil(total / 30) },
    counts: { PENDING: count("PENDING")?._count._all ?? 0, CONFIRMED: count("CONFIRMED")?._count._all ?? 0, REJECTED: count("REJECTED")?._count._all ?? 0 },
    pendingMinor: count("PENDING")?._sum.amountMinor ?? 0, creditedMinor: credited._sum.amountMinor ?? 0,
  };
}

export async function reviewTopUp(db: PrismaClient, actor: Actor, id: string, input: unknown, mail: MailSettings = defaultMail()) {
  assertAdmin(actor);
  const data = reviewInput.parse(input);
  const result = await db.$transaction(async tx => {
    const claim = await tx.topUpRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!claim) throw new AccessError(404, "NOT_FOUND", "Top-up not found");
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${claim.userId} FOR UPDATE`;
    // Only a pending claim can be processed, exactly once.
    const credited = data.decision === "confirm" ? data.creditedKes * 100 : null;
    const claimed = await tx.topUpRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: data.decision === "confirm" ? "CONFIRMED" : "REJECTED", creditedMinor: credited, reviewNote: data.note || null, reviewedById: actor.user.id, reviewedAt: new Date() } });
    if (!claimed.count) throw new AccessError(409, "ALREADY_PROCESSED", "This top-up has already been processed and can't be changed");
    if (credited !== null) {
      const user = await tx.user.update({ where: { id: claim.userId }, data: { walletBalanceMinor: { increment: credited } }, select: { walletBalanceMinor: true } });
      await tx.walletEntry.create({ data: { userId: claim.userId, kind: "TOP_UP", amountMinor: credited, balanceAfterMinor: user.walletBalanceMinor, description: `M-Pesa top-up ${claim.mpesaCode}`, topUpId: claim.id } });
      await tx.auditLog.create({ data: { actorId: actor.user.id, action: "wallet.top_up_confirmed", entityType: "TopUpRequest", entityId: id } });
      const note = await notify(tx, { userId: claim.userId, kind: "wallet.top_up_confirmed", audience: "ACCOUNT", title: `${formatFee(credited)} added to your wallet`, body: `Your M-Pesa top-up ${claim.mpesaCode} was confirmed. New balance: ${formatFee(user.walletBalanceMinor)}.`, href: "/dashboard/wallet" });
      return { claim, notificationId: note.id, email: topUpConfirmedEmail({ baseUrl: mail.baseURL, name: claim.user.name, ...facts(claim, credited), balance: formatFee(user.walletBalanceMinor) }) };
    }
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "wallet.top_up_rejected", entityType: "TopUpRequest", entityId: id } });
    const note = await notify(tx, { userId: claim.userId, kind: "wallet.top_up_rejected", audience: "ACCOUNT", title: "We couldn't confirm your top-up", body: `M-Pesa ${claim.mpesaCode}: ${data.note}`, href: "/dashboard/wallet" });
    return { claim, notificationId: note.id, email: topUpRejectedEmail({ baseUrl: mail.baseURL, name: claim.user.name, ...facts(claim), reason: data.note ?? "" }) };
  });
  await emailNow(db, result.notificationId, result.claim.user.email, result.email, mail);
  return { id, status: data.decision === "confirm" ? "CONFIRMED" as const : "REJECTED" as const };
}

// Pays an application fee from the wallet and submits the application in one step. The same checks as an M-Pesa
// payment apply, and the same paid PaymentOrder is recorded (receipt WALLET-...), so recruiters, receipts and
// dashboards treat it like any other paid application. Locks follow the payment order: User, Application, Job.
export async function payFromWallet(db: PrismaClient, actor: Actor, applicationId: string, input: unknown) {
  const { version } = z.object({ version: z.number().int().positive() }).strict().parse(input);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${applicationId} FOR UPDATE`;
    const application = await tx.application.findFirst({ where: { id: applicationId, userId: actor.user.id }, include: { user: { include: { profile: true } }, job: { include: { recruiter: true } }, documents: { include: { document: true } }, paymentOrder: true } });
    if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
    await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = ${application.jobId} FOR SHARE`;
    if (application.status !== "DRAFT") throw new AccessError(409, "ALREADY_SUBMITTED", "This application is already submitted");
    if (application.version !== version) throw new AccessError(409, "STALE_APPLICATION", "Reload your application before paying");
    if (application.paymentOrder && (application.paymentOrder.reviewHold || busyStatuses.includes(application.paymentOrder.status))) throw new AccessError(409, "PAYMENT_IN_PROGRESS", "A payment is already pending, paid, or awaiting review for this application");
    const job = application.job;
    if (job.status !== "PUBLISHED" || !job.publishedAt || job.deadline <= new Date() || job.recruiter.status !== "ACTIVE") throw new AccessError(409, "JOB_UNAVAILABLE", "This job is no longer accepting applications");
    if (application.user.status !== "ACTIVE" || !application.user.emailVerified) throw new AccessError(403, "ACCOUNT_UNAVAILABLE", "Account access unavailable");
    const profile = profileInput.safeParse(application.user.profile ? { fullName: application.user.profile.fullName, phone: application.user.profile.phone, location: application.user.profile.location, summary: application.user.profile.summary || "" } : {});
    if (!profile.success) throw new AccessError(409, "PROFILE_INCOMPLETE", "Complete your profile before paying");
    const document = application.documents.length === 1 ? application.documents[0].document : null;
    if (!document || document.userId !== actor.user.id || document.scanStatus !== "CLEAN" || !document.sha256) throw new AccessError(409, "CV_NOT_READY", "Attach a CV that has passed security screening before paying");
    const fee = application.applicationFeeMinor;
    if (application.currency !== "KES" || fee < 100) throw new AccessError(409, "INVALID_FEE", "This application fee can't be paid from the wallet");
    if (application.user.walletBalanceMinor < fee) throw new AccessError(409, "INSUFFICIENT_BALANCE", `Your wallet has ${formatFee(application.user.walletBalanceMinor)}. Top up ${formatFee(fee - application.user.walletBalanceMinor)} more to apply.`);

    const snapshot = { ...profile.data, email: application.user.email, coverLetter: application.coverLetter, documentId: document.id, documentSha256: document.sha256, jobTitle: job.title, organisationName: job.recruiter.name || job.recruiter.email, jobVersion: job.version, applicationVersion: application.version + 1 };
    const paidAt = new Date();
    const order = await tx.paymentOrder.upsert({ where: { applicationId }, create: { applicationId, amountMinor: fee, currency: "KES", status: "SUCCEEDED", paidAt, frozenSnapshot: snapshot }, update: { amountMinor: fee, status: "SUCCEEDED", paidAt, frozenSnapshot: snapshot, version: { increment: 1 } } });
    const receipt = `WALLET-${randomBytes(5).toString("hex").toUpperCase()}`;
    await tx.paymentAttempt.create({ data: { paymentOrderId: order.id, idempotencyKey: randomUUID(), status: "SUCCEEDED", receiptNumber: receipt, resultCode: "WALLET" } });
    const user = await tx.user.update({ where: { id: actor.user.id }, data: { walletBalanceMinor: { decrement: fee } }, select: { walletBalanceMinor: true } });
    await tx.walletEntry.create({ data: { userId: actor.user.id, kind: "APPLICATION_FEE", amountMinor: -fee, balanceAfterMinor: user.walletBalanceMinor, description: `Application fee: ${job.title}`, paymentOrderId: order.id } });
    await tx.application.update({ where: { id: applicationId }, data: { status: "SUBMITTED", submittedAt: paidAt, submissionSnapshot: snapshot, version: application.version + 1 } });
    await tx.applicationStatusHistory.create({ data: { applicationId, fromStatus: "DRAFT", toStatus: "SUBMITTED", message: "Application fee paid from wallet" } });
    await tx.outboxEvent.upsert({ where: { deduplicationKey: `application:${applicationId}:submitted` }, update: {}, create: { deduplicationKey: `application:${applicationId}:submitted`, kind: "application.submitted", aggregateId: applicationId } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "wallet.application_paid", entityType: "PaymentOrder", entityId: order.id } });
    return { submitted: true, receipt, balanceMinor: user.walletBalanceMinor };
  }, { timeout: 15000 });
}
