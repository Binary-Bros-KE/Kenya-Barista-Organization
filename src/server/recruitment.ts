import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../generated/prisma/client";
import type { Actor } from "./access";
import { managedScope } from "./jobs";
import { AccessError } from "./errors";
import { readStoredCv } from "./documents";
import { reviewTransitions, withdrawableStatuses } from "../lib/application-format";
import { paidSubmission } from "./submitted-application";

const reviewStatus = z.enum(["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "HIRED", "REJECTED", "WITHDRAWN"]);
const profileSnapshot = z.object({
  fullName: z.string().min(2).max(120), email: z.email(), phone: z.string().max(30), location: z.string().max(120),
  summary: z.string().max(3000), coverLetter: z.string().max(6000), documentId: z.string().min(1).max(100),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/), jobTitle: z.string().max(160), organisationName: z.string().max(200), // the recruiter's name; key kept for stored submissions
});
export function recruitmentScope(actor: Actor): Prisma.ApplicationWhereInput {
  return { ...paidSubmission, job: managedScope(actor) };
}
const querySchema = z.object({
  q: z.string().trim().max(120).default(""), status: reviewStatus.optional(),
  jobId: z.string().min(1).max(100).optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export async function listReviewApplications(db: PrismaClient, actor: Actor, input: unknown) {
  const query = querySchema.parse(input);
  const where: Prisma.ApplicationWhereInput = { ...recruitmentScope(actor), ...(query.status ? { status: query.status } : {}),
    ...(query.jobId ? { jobId: query.jobId } : {}), ...(query.q ? { OR: [{ job: { title: { contains: query.q, mode: "insensitive" } } }, { user: { email: { contains: query.q, mode: "insensitive" } } }] } : {}) };
  const [rows, total] = await Promise.all([
    db.application.findMany({ where, select: { id: true, status: true, submittedAt: true, version: true, submissionSnapshot: true,
      job: { select: { id: true, title: true, recruiter: { select: { name: true } } } },
      user: { select: { id: true, avatarVersion: true, profile: { select: { headline: true } } } } },
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * 20, take: 20 }),
    db.application.count({ where }),
  ]);
  return { applications: rows.map(({ submissionSnapshot, user, ...row }) => {
    const snapshot = profileSnapshot.safeParse(submissionSnapshot);
    return { ...row, applicantName: snapshot.success ? snapshot.data.fullName : "Submitted applicant", applicant: { id: user.id, avatarVersion: user.avatarVersion, headline: user.profile?.headline ?? null } };
  }), pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
}
export async function reviewJobOptions(db: PrismaClient, actor: Actor) {
  return db.job.findMany({ where: { ...managedScope(actor), applications: { some: paidSubmission } },
    select: { id: true, title: true, recruiter: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 200 });
}
export async function getReviewApplication(db: PrismaClient, actor: Actor, id: string) {
  const application = await db.application.findFirst({ where: { id, ...recruitmentScope(actor) }, select: {
    id: true, userId: true, status: true, version: true, submittedAt: true, submissionSnapshot: true, applicationFeeMinor: true, currency: true,
    job: { select: { id: true, title: true, status: true, recruiter: { select: { name: true, status: true } } } },
    paymentOrder: { select: { amountMinor: true, currency: true } },
    documents: { select: { document: { select: { id: true, userId: true, filename: true, scanStatus: true, sha256: true } } } },
    user: { select: { avatarVersion: true, profile: { select: { headline: true, experienceYears: true, skills: true, openToWork: true, instagram: true, linkedin: true, website: true, accent: true } } } },
  } });
  if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
  const snapshot = profileSnapshot.safeParse(application.submissionSnapshot);
  if (!snapshot.success || application.paymentOrder?.amountMinor !== application.applicationFeeMinor || application.paymentOrder.currency !== application.currency) {
    throw new AccessError(409, "SUBMISSION_UNAVAILABLE", "The submitted application requires administrator review");
  }
  const cv = application.documents.find(item => item.document.id === snapshot.data.documentId)?.document;
  const cvMatches = application.status !== "WITHDRAWN" && cv?.userId === application.userId && cv.sha256 === snapshot.data.documentSha256;
  // Recruiters only open CVs that passed the virus scan; one sent while still being scanned shows as "checking".
  const cvAvailable = cvMatches && cv?.scanStatus === "CLEAN", cvScreening = cvMatches && cv?.scanStatus === "PENDING";
  return { id: application.id, userId: application.userId, status: application.status, version: application.version, submittedAt: application.submittedAt,
    job: application.job, profile: snapshot.data, cv: { available: Boolean(cvAvailable), screening: Boolean(cvScreening), filename: cv?.filename || "Submitted CV.pdf" },
    // The candidate's current photo and profile card; the submitted details above stay as they were at submission.
    candidate: { avatarVersion: application.user.avatarVersion, ...application.user.profile } };
}
const responseSelect = { id: true, source: true, senderLabel: true, body: true, status: true, createdAt: true } as const;
async function responses(db: PrismaClient, applicationId: string, rawPage: unknown) {
  const page = z.coerce.number().int().min(1).max(100000).default(1).parse(rawPage);
  const [items, total] = await Promise.all([
    db.applicationResponse.findMany({ where: { applicationId }, select: responseSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }),
    db.applicationResponse.count({ where: { applicationId } }),
  ]);
  return { responses: items, pagination: { page, total, pageCount: Math.ceil(total / 20) } };
}
export async function reviewResponses(db: PrismaClient, actor: Actor, id: string, page?: unknown) {
  await getReviewApplication(db, actor, id); return responses(db, id, page);
}
// Everything the applicant's timeline needs: status changes and responses, oldest first.
export async function applicantTimeline(db: PrismaClient, actor: Actor, id: string) {
  const application = await db.application.findFirst({ where: { id, userId: actor.user.id }, select: { status: true, createdAt: true } });
  if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
  const [history, responses] = await Promise.all([
    db.applicationStatusHistory.findMany({ where: { applicationId: id }, select: { toStatus: true, message: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 }),
    db.applicationResponse.findMany({ where: { applicationId: id }, select: responseSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 }),
  ]);
  return { ...application, history, responses };
}
export async function applicantResponses(db: PrismaClient, actor: Actor, id: string, page?: unknown) {
  if (!await db.application.findFirst({ where: { id, userId: actor.user.id }, select: { id: true } })) throw new AccessError(404, "NOT_FOUND", "Application not found");
  return responses(db, id, page);
}
export async function respondToApplication(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = z.object({ version: z.number().int().positive(), status: z.enum(["UNDER_REVIEW", "SHORTLISTED", "HIRED", "REJECTED"]).optional(), message: z.string().trim().min(2).max(4000) }).strict().parse(input);
  await getReviewApplication(db, actor, id);
  const scope = recruitmentScope(actor);
  return db.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id, ...scope }, include: { job: { include: { recruiter: { select: { name: true, email: true, status: true } } } } } });
    if (!app) throw new AccessError(404, "NOT_FOUND", "Application not found");
    if (app.version !== data.version) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before sending a response");
    if (app.job.recruiter.status !== "ACTIVE") throw new AccessError(409, "RECRUITER_SUSPENDED", "Reactivate the recruiter's account before sending responses");
    if (app.status === "WITHDRAWN") throw new AccessError(409, "APPLICATION_WITHDRAWN", "This application was withdrawn");
    if (data.status && !reviewTransitions[app.status]?.includes(data.status)) throw new AccessError(409, "INVALID_TRANSITION", "That status change is not available");
    const changed = await tx.application.updateMany({ where: { id, version: data.version, ...scope }, data: { ...(data.status ? { status: data.status } : {}), version: { increment: 1 } } });
    if (!changed.count) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before sending a response");
    const response = await tx.applicationResponse.create({ data: { applicationId: id, authorId: actor.user.id, source: actor.user.role === "ADMIN" ? "ADMIN" : "EMPLOYER",
      senderLabel: actor.user.role === "ADMIN" ? "KBO recruitment administration" : app.job.recruiter.name || app.job.recruiter.email, body: data.message, status: data.status || app.status }, select: responseSelect });
    if (data.status) await tx.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: data.status, message: data.message } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: data.status ? "application.status_changed" : "application.response_sent", entityType: "Application", entityId: id } });
    await tx.outboxEvent.create({ data: { deduplicationKey: `response:${response.id}`, kind: "application.response", aggregateId: response.id } });
    return { response, version: data.version + 1 };
  });
}
export async function withdrawApplication(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = z.object({ version: z.number().int().positive(), reason: z.string().trim().max(2000).default("") }).strict().parse(input);
  return db.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id, userId: actor.user.id } });
    if (!app) throw new AccessError(404, "NOT_FOUND", "Application not found");
    if (app.version !== data.version) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before withdrawing");
    if (!withdrawableStatuses.includes(app.status)) throw new AccessError(409, "CANNOT_WITHDRAW", "This application cannot be withdrawn");
    const changed = await tx.application.updateMany({ where: { id, userId: actor.user.id, version: data.version, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } }, data: { status: "WITHDRAWN", version: { increment: 1 } } });
    if (!changed.count) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before withdrawing");
    const body = data.reason || "The applicant withdrew this application.";
    await tx.applicationResponse.create({ data: { applicationId: id, authorId: actor.user.id, source: "APPLICANT", senderLabel: "Applicant", body, status: "WITHDRAWN" } });
    await tx.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: "WITHDRAWN", message: body } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "application.withdrawn", entityType: "Application", entityId: id } });
    await tx.outboxEvent.create({ data: { deduplicationKey: `application:${id}:withdrawn`, kind: "application.withdrawn", aggregateId: id } });
    return { id, status: "WITHDRAWN", version: data.version + 1 };
  });
}
// Viewing in the page and downloading read the same checked file; the audit log records which one happened.
export async function downloadReviewCv(db: PrismaClient, actor: Actor, id: string, purpose: "download" | "view" = "download") {
  const app = await getReviewApplication(db, actor, id);
  if (!app.cv.available) throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
  const document = await db.document.findFirst({ where: { id: app.profile.documentId, scanStatus: "CLEAN", sha256: app.profile.documentSha256, applications: { some: { applicationId: id } } } });
  if (!document) throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
  const bytes = await readStoredCv(document).catch((error: unknown) => {
    if (error instanceof AccessError && error.code === "CV_UNAVAILABLE") throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
    throw error;
  });
  if (bytes.length !== document.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== app.profile.documentSha256) throw new AccessError(409, "CV_UNAVAILABLE", "The submitted CV requires security review");
  await db.auditLog.create({ data: { actorId: actor.user.id, action: purpose === "view" ? "application.cv_viewed" : "application.cv_downloaded", entityType: "Application", entityId: id } });
  return { bytes, filename: document.filename };
}
