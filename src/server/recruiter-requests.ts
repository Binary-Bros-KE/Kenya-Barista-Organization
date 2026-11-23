import { z } from "zod";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { defaultMail, emailNow, notify, type MailSettings } from "./instant-email";
import { recruiterApprovedEmail, recruiterRejectedEmail, recruiterRequestReceivedEmail, recruiterVerifiedEmail } from "./email-templates";

// Job seekers ask to become recruiters; administrators approve or reject the request,
// and later verify a recruiter's contact details so their jobs carry a "Verified" badge.

const optionalUrl = z.string().trim().max(200).optional().transform(value => value || undefined)
  .refine(value => !value || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value), "Enter a website or social media link, e.g. instagram.com/yourcafe");
export const recruiterRequestInput = z.object({
  hiringFor: z.string().trim().min(2, "Tell us who you are hiring for").max(160),
  roles: z.string().trim().min(2, "List the roles you plan to hire for").max(300),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, "Use +254 followed by your mobile number"),
  location: z.string().trim().min(2).max(120),
  website: optionalUrl,
  message: z.string().trim().max(1000).default(""),
}).strict();

// Checks an administrator confirms before marking a recruiter verified. Email is checked automatically.
export const verificationChecks = {
  phone: "Phone number confirmed by call or message",
  identity: "Identity or business confirmed",
  presence: "Online presence or premises checked",
} as const;
type Check = keyof typeof verificationChecks;
const requiredChecks: Check[] = ["phone", "identity"];

const requestSelect = {
  id: true, status: true, hiringFor: true, roles: true, phone: true, location: true, website: true, message: true,
  reviewNote: true, reviewedAt: true, createdAt: true,
} as const;


// Every request is kept. Each account can send this many in total, withdrawn ones included.
export const MAX_RECRUITER_REQUESTS = 3;

// The latest request, the earlier ones (newest first) and how many of the allowed requests are left.
export async function myRecruiterRequests(db: PrismaClient, actor: Actor) {
  const [latest, ...earlier] = await db.recruiterRequest.findMany({ where: { userId: actor.user.id }, select: requestSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  const used = latest ? earlier.length + 1 : 0;
  return { request: latest ?? null, earlier, used, limit: MAX_RECRUITER_REQUESTS, remaining: Math.max(0, MAX_RECRUITER_REQUESTS - used) };
}

export async function submitRecruiterRequest(db: PrismaClient, actor: Actor, input: unknown, mail: MailSettings = defaultMail()) {
  if (actor.user.role !== "APPLICANT") throw new AccessError(409, "ALREADY_RECRUITER", "Your account already has recruiter or administrator access");
  const data = recruiterRequestInput.parse(input);
  return db.$transaction(async tx => {
    if (await tx.recruiterRequest.findFirst({ where: { userId: actor.user.id, status: "PENDING" }, select: { id: true } })) throw new AccessError(409, "REQUEST_PENDING", "You already have a request waiting for review");
    if (await tx.recruiterRequest.count({ where: { userId: actor.user.id } }) >= MAX_RECRUITER_REQUESTS) throw new AccessError(409, "REQUEST_LIMIT", `You've used all ${MAX_RECRUITER_REQUESTS} recruiter requests. Contact KBO if your situation has changed.`);
    const request = await tx.recruiterRequest.create({ data: { ...data, userId: actor.user.id }, select: requestSelect });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "recruiter_request.submitted", entityType: "RecruiterRequest", entityId: request.id } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    for (const admin of admins) await notify(tx, { userId: admin.id, kind: "recruiter_request.submitted", audience: "ADMIN", title: "New recruiter request", body: `${actor.user.name || actor.user.email} wants to recruit for ${data.hiringFor}.`, href: "/admin?view=requests" });
    const receipt = await notify(tx, { userId: actor.user.id, kind: "recruiter_request.received", audience: "ACCOUNT", title: "We've received your recruiter request", body: "KBO will review it, usually within two working days.", href: "/dashboard/recruiter-request" });
    return { request, receiptId: receipt.id };
  }).then(async ({ request, receiptId }) => {
    await emailNow(db, receiptId, actor.user.email, recruiterRequestReceivedEmail({ baseUrl: mail.baseURL, name: actor.user.name, ...data }), mail);
    return request;
  }).catch(error => {
    // The partial unique index also blocks two pending requests submitted at the same moment.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new AccessError(409, "REQUEST_PENDING", "You already have a request waiting for review");
    throw error;
  });
}

export async function withdrawRecruiterRequest(db: PrismaClient, actor: Actor) {
  const result = await db.recruiterRequest.updateMany({ where: { userId: actor.user.id, status: "PENDING" }, data: { status: "WITHDRAWN" } });
  if (!result.count) throw new AccessError(404, "NOT_FOUND", "There is no pending request to withdraw");
  return { withdrawn: true };
}

const one = (value: unknown) => Array.isArray(value) ? value[0] : value;
export const requestQuery = z.object({
  q: z.preprocess(one, z.string().trim().max(100).catch("")).default(""),
  status: z.preprocess(one, z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]).catch("PENDING")).default("PENDING"),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(100000).catch(1)).default(1),
});

export async function listRecruiterRequests(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const query = requestQuery.parse(input);
  const contains = { contains: query.q, mode: "insensitive" as const };
  const where: Prisma.RecruiterRequestWhereInput = {
    ...(query.status === "ALL" ? { status: { not: "WITHDRAWN" } } : { status: query.status }),
    ...(query.q ? { OR: [{ hiringFor: contains }, { roles: contains }, { location: contains }, { user: { name: contains } }, { user: { email: contains } }] } : {}),
  };
  const [matching, rows, pending] = await Promise.all([
    db.recruiterRequest.count({ where }),
    db.recruiterRequest.findMany({
      where, orderBy: [{ createdAt: query.status === "PENDING" ? "asc" : "desc" }, { id: "asc" }], skip: (query.page - 1) * 25, take: 25,
      select: { ...requestSelect, reviewedBy: { select: { name: true, email: true } },
        user: { select: { id: true, name: true, email: true, role: true, status: true, emailVerified: true, createdAt: true, lastSignInAt: true, avatarVersion: true, _count: { select: { applications: true } } } } },
    }),
    db.recruiterRequest.count({ where: { status: "PENDING" } }),
  ]);
  return { query, pending, pagination: { page: query.page, matching, pageCount: Math.max(1, Math.ceil(matching / 25)) }, requests: rows };
}
export type RecruiterRequestList = Awaited<ReturnType<typeof listRecruiterRequests>>;

export const reviewInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(1000).optional() }).strict(),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(5, "Tell them why, so they can apply again with the right details").max(1000) }).strict(),
]);

export async function reviewRecruiterRequest(db: PrismaClient, actor: Actor, id: string, input: unknown, mail: MailSettings = defaultMail()) {
  assertAdmin(actor);
  const data = reviewInput.parse(input);
  const result = await db.$transaction(async tx => {
    const request = await tx.recruiterRequest.findUnique({ where: { id }, include: { user: { select: { id: true, role: true, name: true, email: true } } } });
    if (!request) throw new AccessError(404, "NOT_FOUND", "Request not found");
    const claimed = await tx.recruiterRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: data.decision === "approve" ? "APPROVED" : "REJECTED", reviewNote: data.note || null, reviewedById: actor.user.id, reviewedAt: new Date() } });
    if (!claimed.count) throw new AccessError(409, "ALREADY_REVIEWED", "This request has already been reviewed or withdrawn");
    if (data.decision === "approve") {
      if (request.user.role === "ADMIN") throw new AccessError(409, "ADMIN_ACCOUNT", "Administrator accounts can't become recruiters");
      if (request.user.role !== "RECRUITER") await tx.user.update({ where: { id: request.userId }, data: { role: "RECRUITER" } });
      const approved = await notify(tx, { userId: request.userId, kind: "recruiter_request.approved", audience: "ACCOUNT", title: "You're now a recruiter on KBO", body: "Your recruiter request was approved. You can post jobs and review applicants from your dashboard.", href: "/employer/jobs/new" });
      await tx.auditLog.create({ data: { actorId: actor.user.id, action: "recruiter_request.approved", entityType: "User", entityId: request.userId } });
      return { id, status: "APPROVED" as const, email: { notificationId: approved.id, to: request.user.email, name: request.user.name } };
    }
    const rejected = await notify(tx, { userId: request.userId, kind: "recruiter_request.rejected", audience: "ACCOUNT", title: "Your recruiter request wasn't approved", body: `Reason: ${data.note}`, href: "/dashboard/recruiter-request" });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "recruiter_request.rejected", entityType: "User", entityId: request.userId } });
    return { id, status: "REJECTED" as const, email: { notificationId: rejected.id, to: request.user.email, name: request.user.name } };
  });
  const email = result.status === "APPROVED"
    ? recruiterApprovedEmail({ baseUrl: mail.baseURL, name: result.email.name, note: data.note })
    : recruiterRejectedEmail({ baseUrl: mail.baseURL, name: result.email.name, reason: data.note ?? "" });
  await emailNow(db, result.email.notificationId, result.email.to, email, mail);
  return { id: result.id, status: result.status };
}

export const verificationInput = z.object({
  checks: z.array(z.enum(Object.keys(verificationChecks) as [Check, ...Check[]])).max(3),
  note: z.string().trim().max(1000).default(""),
}).strict();

export async function verifyRecruiter(db: PrismaClient, actor: Actor, id: string, input: unknown, mail: MailSettings = defaultMail()) {
  assertAdmin(actor);
  const data = verificationInput.parse(input);
  const missing = requiredChecks.filter(check => !data.checks.includes(check));
  if (missing.length) throw new AccessError(400, "CHECKS_INCOMPLETE", `Confirm these first: ${missing.map(check => verificationChecks[check].toLowerCase()).join("; ")}`);
  const result = await db.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id, role: "RECRUITER" }, select: { id: true, emailVerified: true, name: true, email: true } });
    if (!user) throw new AccessError(404, "NOT_FOUND", "Recruiter not found");
    if (!user.emailVerified) throw new AccessError(409, "EMAIL_UNVERIFIED", "The recruiter must confirm their email address first");
    const verifiedAt = new Date();
    await tx.user.update({ where: { id }, data: { recruiterVerifiedAt: verifiedAt, recruiterVerifiedById: actor.user.id, recruiterVerification: { checks: ["email", ...new Set(data.checks)], note: data.note } } });
    const notice = await notify(tx, { userId: id, kind: "recruiter.verified", audience: "ACCOUNT", title: "You're a verified recruiter", body: "KBO has confirmed your details. Your jobs now show a Verified badge.", href: "/dashboard" });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "recruiter.verified", entityType: "User", entityId: id } });
    return { verifiedAt, notificationId: notice.id, to: user.email, name: user.name };
  });
  await emailNow(db, result.notificationId, result.to, recruiterVerifiedEmail({ baseUrl: mail.baseURL, name: result.name }), mail);
  return { verifiedAt: result.verifiedAt };
}

export async function unverifyRecruiter(db: PrismaClient, actor: Actor, id: string) {
  assertAdmin(actor);
  return db.$transaction(async tx => {
    const result = await tx.user.updateMany({ where: { id, recruiterVerifiedAt: { not: null } }, data: { recruiterVerifiedAt: null, recruiterVerifiedById: null, recruiterVerification: Prisma.DbNull } });
    if (!result.count) throw new AccessError(404, "NOT_FOUND", "This recruiter isn't verified");
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "recruiter.unverified", entityType: "User", entityId: id } });
    return { verified: false };
  });
}
