import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { paidSubmission } from "./submitted-application";

const category = z.enum(["BARISTA", "ROASTING", "HOSPITALITY", "TRAINING", "MANAGEMENT", "OTHER"]);
const employmentType = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"]);
const feeKes = z.number().int().min(1).max(250000);
const fields = {
  title: z.string().trim().min(5).max(160), description: z.string().trim().min(50).max(12000),
  location: z.string().trim().min(2).max(120), category, employmentType,
  deadline: z.iso.datetime({ offset: true }).transform(value => new Date(value)),
};
const employerInput = z.object(fields).strict();
const adminInput = employerInput.extend({ applicationFeeKes: feeKes.optional() }).strict();
const actions = z.enum(["submit", "withdraw", "publish", "request_changes", "close", "archive", "reopen"]);
type Action = z.infer<typeof actions>;
type Transaction = Prisma.TransactionClient;

export function managedScope(actor: Actor): Prisma.JobWhereInput {
  if (actor.user.role === "ADMIN") { assertAdmin(actor); return {}; }
  return { organisation: { suspendedAt: null, members: { some: { userId: actor.user.id } } } };
}
function futureDeadline(deadline: Date) {
  if (deadline <= new Date()) throw new AccessError(400, "DEADLINE_PASSED", "Choose a future application deadline");
}
async function history(tx: Transaction, jobId: string, actorId: string | null, fromStatus: Prisma.JobStatusHistoryCreateInput["fromStatus"], toStatus: Prisma.JobStatusHistoryCreateInput["toStatus"], action: string, note?: string) {
  await tx.jobStatusHistory.create({ data: { jobId, actorId, fromStatus, toStatus, note } });
  await tx.auditLog.create({ data: { actorId, action: `job.${action}`, entityType: "Job", entityId: jobId } });
}
async function scopedJob(tx: Transaction, actor: Actor, id: string) {
  const job = await tx.job.findFirst({ where: { id, ...managedScope(actor) }, include: { organisation: { select: { id: true, name: true, suspendedAt: true } } } });
  if (!job) throw new AccessError(404, "NOT_FOUND", "Job not found");
  return job;
}

export async function defaultFee(db: PrismaClient) { return (await db.platformSettings.findUnique({ where: { id: "platform" } }))?.defaultApplicationFeeMinor ?? null; }
export async function setDefaultFee(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const value = z.object({ applicationFeeKes: feeKes }).strict().parse(input).applicationFeeKes * 100;
  return db.$transaction(async tx => {
    const settings = await tx.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform", defaultApplicationFeeMinor: value }, update: { defaultApplicationFeeMinor: value } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "settings.default_application_fee_changed", entityType: "PlatformSettings", entityId: "platform" } });
    return { defaultApplicationFeeMinor: settings.defaultApplicationFeeMinor };
  });
}

export async function createJob(db: PrismaClient, actor: Actor, organisationId: string, input: unknown) {
  const isAdmin = actor.user.role === "ADMIN";
  if (isAdmin) assertAdmin(actor);
  const data = (isAdmin ? adminInput : employerInput).parse(input);
  futureDeadline(data.deadline);
  return db.$transaction(async tx => {
    const organisation = await tx.organisation.findFirst({ where: { id: organisationId, suspendedAt: null, ...(!isAdmin ? { members: { some: { userId: actor.user.id } } } : {}) } });
    if (!organisation) throw new AccessError(404, "NOT_FOUND", "Active organisation not found");
    const suppliedFee = "applicationFeeKes" in data && typeof data.applicationFeeKes === "number" ? data.applicationFeeKes * 100 : null;
    const amount = suppliedFee ?? (await tx.platformSettings.findUnique({ where: { id: "platform" } }))?.defaultApplicationFeeMinor;
    if (amount == null) throw new AccessError(409, "FEE_NOT_CONFIGURED", "An administrator must configure the application fee first");
    const { title, description, location, category, employmentType, deadline } = data;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "coffee-career"}-${randomUUID().slice(0, 8)}`;
    const job = await tx.job.create({ data: { organisationId, createdById: actor.user.id, title, description, location, category, employmentType, deadline, slug, applicationFeeMinor: amount } });
    await history(tx, job.id, actor.user.id, null, "DRAFT", "created");
    return job;
  });
}

export async function updateJob(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const isAdmin = actor.user.role === "ADMIN";
  const schema = (isAdmin ? adminInput : employerInput).extend({ version: z.number().int().positive() }).strict();
  const data = schema.parse(input);
  futureDeadline(data.deadline);
  return db.$transaction(async tx => {
    const job = await scopedJob(tx, actor, id);
    if (job.organisation.suspendedAt) throw new AccessError(409, "ORGANISATION_SUSPENDED", "Reactivate the organisation before editing jobs");
    if (!["DRAFT", "CHANGES_REQUESTED", "PUBLISHED"].includes(job.status)) throw new AccessError(409, "INVALID_JOB_STATE", "Withdraw or reopen this posting before editing it");
    if (job.version !== data.version) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before saving.");
    const amount = "applicationFeeKes" in data && typeof data.applicationFeeKes === "number" ? data.applicationFeeKes * 100 : job.applicationFeeMinor;
    if (amount !== job.applicationFeeMinor && await tx.application.count({ where: { jobId: id } })) throw new AccessError(409, "FEE_LOCKED", "The fee cannot change after an application has been started");
    const { title, description, location, category, employmentType, deadline } = data;
    const result = await tx.job.updateMany({ where: { id, version: data.version }, data: { title, description, location, category, employmentType, deadline, applicationFeeMinor: amount, status: "DRAFT", version: { increment: 1 } } });
    if (result.count !== 1) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before saving.");
    await history(tx, id, actor.user.id, job.status, "DRAFT", "edited", job.status === "PUBLISHED" ? "Published posting returned to draft after editing" : "Posting edited");
    if (job.status === "PUBLISHED") await tx.outboxEvent.create({ data: { deduplicationKey: `job:${id}:${data.version + 1}:edited`, kind: "job.updated", aggregateId: id } });
    return tx.job.findUniqueOrThrow({ where: { id } });
  });
}

export async function transitionJob(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = z.object({ version: z.number().int().positive(), action: actions, note: z.string().trim().max(2000).optional() }).strict().parse(input);
  return db.$transaction(async tx => {
    const job = await scopedJob(tx, actor, id);
    if (job.version !== data.version) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before continuing.");
    const allowed: Record<Action, string[]> = {
      submit: ["DRAFT", "CHANGES_REQUESTED"], withdraw: ["PENDING_REVIEW"], publish: ["PENDING_REVIEW"],
      request_changes: ["PENDING_REVIEW"], close: ["PUBLISHED"], archive: ["DRAFT", "CHANGES_REQUESTED", "CLOSED"], reopen: ["CLOSED"],
    };
    if (["publish", "request_changes"].includes(data.action)) assertAdmin(actor);
    if (!allowed[data.action].includes(job.status)) throw new AccessError(409, "INVALID_JOB_STATE", "That action is not available for this job");
    if (job.organisation.suspendedAt && !["close", "archive"].includes(data.action)) throw new AccessError(409, "ORGANISATION_SUSPENDED", "Reactivate the organisation before submitting or publishing jobs");
    if (["submit", "publish"].includes(data.action)) futureDeadline(job.deadline);
    if (data.action === "request_changes" && !data.note) throw new AccessError(400, "REVIEW_NOTE_REQUIRED", "Explain the changes the employer should make");
    const next = { submit: "PENDING_REVIEW", withdraw: "DRAFT", publish: "PUBLISHED", request_changes: "CHANGES_REQUESTED", close: "CLOSED", archive: "ARCHIVED", reopen: "DRAFT" } as const;
    const changes: Prisma.JobUpdateManyMutationInput = { status: next[data.action], version: { increment: 1 } };
    if (data.action === "publish") Object.assign(changes, { publishedAt: job.publishedAt ?? new Date(), reviewedById: actor.user.id, reviewedAt: new Date(), reviewNote: null, closedAt: null });
    if (data.action === "request_changes") Object.assign(changes, { reviewedById: actor.user.id, reviewedAt: new Date(), reviewNote: data.note });
    if (data.action === "close") changes.closedAt = new Date();
    if (data.action === "reopen") changes.closedAt = null;
    const result = await tx.job.updateMany({ where: { id, version: data.version }, data: changes });
    if (result.count !== 1) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before continuing.");
    await history(tx, id, actor.user.id, job.status, next[data.action], data.action, data.note);
    await tx.outboxEvent.create({ data: { deduplicationKey: `job:${id}:${data.version + 1}:${data.action}`, kind: `job.${data.action}`, aggregateId: id } });
    return tx.job.findUniqueOrThrow({ where: { id } });
  });
}

export async function getManagedJob(db: PrismaClient, actor: Actor, id: string) {
  const job = await db.job.findFirst({ where: { id, ...managedScope(actor) }, include: { organisation: { select: { id: true, name: true, suspendedAt: true } }, history: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } } } });
  if (!job) throw new AccessError(404, "NOT_FOUND", "Job not found");
  return job;
}

export async function listManagedJobs(db: PrismaClient, actor: Actor, input: unknown) {
  const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.enum(["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(), organisationId: z.string().max(100).optional() }).strict().parse(input);
  const where: Prisma.JobWhereInput = { ...managedScope(actor), ...(query.status ? { status: query.status } : {}), ...(query.organisationId ? { organisationId: query.organisationId } : {}) };
  const [total, jobs] = await db.$transaction([
    db.job.count({ where }), db.job.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * 20, take: 20, select: { id: true, title: true, slug: true, status: true, version: true, deadline: true, applicationFeeMinor: true, organisation: { select: { id: true, name: true } }, _count: { select: { applications: { where: paidSubmission } } } } }),
  ]);
  return { jobs, pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
}

export async function closeExpiredJobs(db: PrismaClient) {
  const jobs = await db.job.findMany({ where: { status: "PUBLISHED", deadline: { lte: new Date() } }, select: { id: true, version: true }, take: 100 });
  let closed = 0;
  for (const job of jobs) {
    const changed = await db.$transaction(async tx => {
      const result = await tx.job.updateMany({ where: { id: job.id, version: job.version, status: "PUBLISHED", deadline: { lte: new Date() } }, data: { status: "CLOSED", closedAt: new Date(), version: { increment: 1 } } });
      if (!result.count) return false;
      await history(tx, job.id, null, "PUBLISHED", "CLOSED", "deadline_closed", "Application deadline reached");
      await tx.outboxEvent.create({ data: { deduplicationKey: `job:${job.id}:${job.version + 1}:deadline_closed`, kind: "job.close", aggregateId: job.id } });
      return true;
    });
    if (changed) closed++;
  }
  return { closed, batchLimit: 100 };
}
