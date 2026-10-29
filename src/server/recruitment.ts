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
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/), jobTitle: z.string().max(160), organisationName: z.string().max(200),
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
      job: { select: { id: true, title: true, organisation: { select: { name: true } } } } },
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * 20, take: 20 }),
    db.application.count({ where }),
  ]);
  return { applications: rows.map(({ submissionSnapshot, ...row }) => {
    const snapshot = profileSnapshot.safeParse(submissionSnapshot);
    return { ...row, applicantName: snapshot.success ? snapshot.data.fullName : "Submitted applicant" };
  }), pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
}
export async function reviewJobOptions(db: PrismaClient, actor: Actor) {
  return db.job.findMany({ where: { ...managedScope(actor), applications: { some: paidSubmission } },
    select: { id: true, title: true, organisation: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 200 });
}
export async function getReviewApplication(db: PrismaClient, actor: Actor, id: string) {
  const application = await db.application.findFirst({ where: { id, ...recruitmentScope(actor) }, select: {
    id: true, userId: true, status: true, version: true, submittedAt: true, submissionSnapshot: true, applicationFeeMinor: true, currency: true,
    job: { select: { id: true, title: true, status: true, organisation: { select: { name: true, suspendedAt: true } } } },
    paymentOrder: { select: { amountMinor: true, currency: true } },
    documents: { select: { document: { select: { id: true, userId: true, filename: true, scanStatus: true, sha256: true } } } },
  } });
  if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
  const snapshot = profileSnapshot.safeParse(application.submissionSnapshot);
  if (!snapshot.success || application.paymentOrder?.amountMinor !== application.applicationFeeMinor || application.paymentOrder.currency !== application.currency) {
    throw new AccessError(409, "SUBMISSION_UNAVAILABLE", "The submitted application requires administrator review");
  }
  const cv = application.documents.find(item => item.document.id === snapshot.data.documentId)?.document;
  const cvAvailable = application.status !== "WITHDRAWN" && cv?.userId === application.userId && cv.scanStatus === "CLEAN" && cv.sha256 === snapshot.data.documentSha256;
  return { id: application.id, status: application.status, version: application.version, submittedAt: application.submittedAt,
    job: application.job, profile: snapshot.data, cv: { available: Boolean(cvAvailable), filename: cv?.filename || "Submitted CV.pdf" } };
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
export async function applicantResponses(db: PrismaClient, actor: Actor, id: string, page?: unknown) {
  if (!await db.application.findFirst({ where: { id, userId: actor.user.id }, select: { id: true } })) throw new AccessError(404, "NOT_FOUND", "Application not found");
  return responses(db, id, page);
}
export async function respondToApplication(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = z.object({ version: z.number().int().positive(), status: z.enum(["UNDER_REVIEW", "SHORTLISTED", "HIRED", "REJECTED"]).optional(), message: z.string().trim().min(2).max(4000) }).strict().parse(input);
  await getReviewApplication(db, actor, id);
  const scope = recruitmentScope(actor);
  return db.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id, ...scope }, include: { job: { include: { organisation: true } } } });
    if (!app) throw new AccessError(404, "NOT_FOUND", "Application not found");
    if (app.version !== data.version) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before sending a response");
    if (app.job.organisation.suspendedAt) throw new AccessError(409, "ORGANISATION_SUSPENDED", "Reactivate the organisation before sending responses");
    if (app.status === "WITHDRAWN") throw new AccessError(409, "APPLICATION_WITHDRAWN", "This application was withdrawn");
    if (data.status && !reviewTransitions[app.status]?.includes(data.status)) throw new AccessError(409, "INVALID_TRANSITION", "That status change is not available");
    const changed = await tx.application.updateMany({ where: { id, version: data.version, ...scope }, data: { ...(data.status ? { status: data.status } : {}), version: { increment: 1 } } });
    if (!changed.count) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before sending a response");
    const response = await tx.applicationResponse.create({ data: { applicationId: id, authorId: actor.user.id, source: actor.user.role === "ADMIN" ? "ADMIN" : "EMPLOYER",
      senderLabel: actor.user.role === "ADMIN" ? "KBO recruitment administration" : app.job.organisation.name, body: data.message, status: data.status || app.status }, select: responseSelect });
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
export async function downloadReviewCv(db: PrismaClient, actor: Actor, id: string) {
  const app = await getReviewApplication(db, actor, id);
  if (!app.cv.available) throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
  const document = await db.document.findFirst({ where: { id: app.profile.documentId, scanStatus: "CLEAN", sha256: app.profile.documentSha256, applications: { some: { applicationId: id } } } });
  if (!document) throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
  const bytes = await readStoredCv(document.storageKey).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new AccessError(404, "CV_UNAVAILABLE", "The submitted CV is unavailable");
    throw error;
  });
  if (bytes.length !== document.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== app.profile.documentSha256) throw new AccessError(409, "CV_UNAVAILABLE", "The submitted CV requires security review");
  await db.auditLog.create({ data: { actorId: actor.user.id, action: "application.cv_downloaded", entityType: "Application", entityId: id } });
  return { bytes, filename: document.filename };
}
