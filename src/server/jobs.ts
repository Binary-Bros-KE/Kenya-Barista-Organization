import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma, JobStatus } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { paidSubmission } from "./submitted-application";
import { checkImage, defaultImageStore, type ImageStore } from "./images";
import { imagePublicId } from "../lib/images";
import { formatFee } from "../lib/job-format";
import { asEmployer } from "../lib/employer";

const category = z.enum(["BARISTA", "ROASTING", "HOSPITALITY", "TRAINING", "MANAGEMENT", "OTHER"]);
const employmentType = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"]);
const feeKes = z.number().int().min(1).max(250000);
const fields = {
  title: z.string().trim().min(5).max(160), description: z.string().trim().min(50).max(12000),
  location: z.string().trim().min(2).max(120), category, employmentType,
  deadline: z.iso.datetime({ offset: true }).transform(value => new Date(value)),
};
// Recruiters set the application fee for their jobs (the platform default is used if they leave it out);
// administrators can adjust it before approval with setJobFee.
const jobInput = z.object({ ...fields, applicationFeeKes: feeKes.optional() }).strict();
const suspendedRecruiter = () => new AccessError(409, "RECRUITER_SUSPENDED", "Reactivate the recruiter's account before editing, submitting or publishing this job");
const actions = z.enum(["submit", "withdraw", "publish", "request_changes", "close", "archive", "reopen"]);
type Action = z.infer<typeof actions>;
type Transaction = Prisma.TransactionClient;

export function managedScope(actor: Actor): Prisma.JobWhereInput {
  if (actor.user.role === "ADMIN") { assertAdmin(actor); return {}; }
  return { recruiterId: actor.user.id, recruiter: { role: "RECRUITER" } };
}
function futureDeadline(deadline: Date) {
  if (deadline <= new Date()) throw new AccessError(400, "DEADLINE_PASSED", "Choose a future application deadline");
}
async function history(tx: Transaction, jobId: string, actorId: string | null, fromStatus: Prisma.JobStatusHistoryCreateInput["fromStatus"], toStatus: Prisma.JobStatusHistoryCreateInput["toStatus"], action: string, note?: string) {
  await tx.jobStatusHistory.create({ data: { jobId, actorId, fromStatus, toStatus, note } });
  await tx.auditLog.create({ data: { actorId, action: `job.${action}`, entityType: "Job", entityId: jobId } });
}
async function scopedJob(tx: Transaction, actor: Actor, id: string) {
  const job = await tx.job.findFirst({ where: { id, ...managedScope(actor) }, include: { recruiter: { select: { id: true, name: true, email: true, status: true } } } });
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

// Recruiters post as themselves; administrators post on behalf of a recruiter (recruiterId).
// Recruiters post their own jobs; administrators post as KBO (the job belongs to the administrator's account).
export async function createJob(db: PrismaClient, actor: Actor, input: unknown) {
  const isAdmin = actor.user.role === "ADMIN";
  if (isAdmin) assertAdmin(actor);
  const data = jobInput.parse(input);
  futureDeadline(data.deadline);
  return db.$transaction(async tx => {
    if (!isAdmin && actor.user.role !== "RECRUITER") throw new AccessError(403, "FORBIDDEN", "Recruiter access required");
    const owner = await tx.user.findFirst({ where: { id: actor.user.id, role: isAdmin ? "ADMIN" : "RECRUITER", status: "ACTIVE" }, select: { id: true } });
    if (!owner) throw new AccessError(404, "NOT_FOUND", "Active account not found");
    const suppliedFee = "applicationFeeKes" in data && typeof data.applicationFeeKes === "number" ? data.applicationFeeKes * 100 : null;
    const amount = suppliedFee ?? (await tx.platformSettings.findUnique({ where: { id: "platform" } }))?.defaultApplicationFeeMinor;
    if (amount == null) throw new AccessError(409, "FEE_NOT_CONFIGURED", "Enter the application fee for this job");
    const { title, description, location, category, employmentType, deadline } = data;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "coffee-career"}-${randomUUID().slice(0, 8)}`;
    const job = await tx.job.create({ data: { recruiterId: owner.id, createdById: actor.user.id, title, description, location, category, employmentType, deadline, slug, applicationFeeMinor: amount } });
    await history(tx, job.id, actor.user.id, null, "DRAFT", "created");
    return job;
  });
}

export async function updateJob(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const isAdmin = actor.user.role === "ADMIN";
  const schema = jobInput.extend({ version: z.number().int().positive() }).strict();
  const data = schema.parse(input);
  futureDeadline(data.deadline);
  return db.$transaction(async tx => {
    const job = await scopedJob(tx, actor, id);
    if (job.recruiter.status !== "ACTIVE") throw suspendedRecruiter();
    if (!["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW", "PUBLISHED"].includes(job.status)) throw new AccessError(409, "INVALID_JOB_STATE", "Reopen this posting before editing it");
    // Edits while awaiting review keep the job in review (the administrator sees the latest version);
    // any other edit returns it to draft, and a published job leaves the public site until it's approved again.
    const next = job.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT";
    if (job.version !== data.version) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before saving.");
    const amount = "applicationFeeKes" in data && typeof data.applicationFeeKes === "number" ? data.applicationFeeKes * 100 : job.applicationFeeMinor;
    if (amount !== job.applicationFeeMinor && await tx.application.count({ where: { jobId: id } })) throw new AccessError(409, "FEE_LOCKED", "The fee cannot change after an application has been started");
    const { title, description, location, category, employmentType, deadline } = data;
    const result = await tx.job.updateMany({ where: { id, version: data.version }, data: { title, description, location, category, employmentType, deadline, applicationFeeMinor: amount, status: next, version: { increment: 1 } } });
    if (result.count !== 1) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before saving.");
    await history(tx, id, actor.user.id, job.status, next, "edited", job.status === "PUBLISHED" ? "Published posting returned to draft after editing" : job.status === "PENDING_REVIEW" ? "Edited while awaiting review" : "Posting edited");
    if (job.status === "PUBLISHED") await tx.outboxEvent.create({ data: { deduplicationKey: `job:${id}:${data.version + 1}:edited`, kind: "job.updated", aggregateId: id } });
    return tx.job.findUniqueOrThrow({ where: { id } });
  });
}

// Cover photos follow the same rules as other edits: only editable postings, the latest version,
// and a published posting goes back to draft so an administrator reviews the new image.
async function coverTarget(db: PrismaClient, actor: Actor, id: string, version: number) {
  const job = await db.job.findFirst({ where: { id, ...managedScope(actor) }, select: { id: true, status: true, version: true, coverVersion: true, recruiter: { select: { status: true } } } });
  if (!job) throw new AccessError(404, "NOT_FOUND", "Job not found");
  if (job.recruiter.status !== "ACTIVE") throw suspendedRecruiter();
  if (!["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW", "PUBLISHED"].includes(job.status)) throw new AccessError(409, "INVALID_JOB_STATE", "Reopen this posting before changing its cover");
  if (job.version !== version) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before changing the cover.");
  return job;
}
async function saveCover(db: PrismaClient, actor: Actor, job: Awaited<ReturnType<typeof coverTarget>>, version: number, coverVersion: number | null) {
  return db.$transaction(async tx => {
    const next = job.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT";
    const result = await tx.job.updateMany({ where: { id: job.id, version }, data: { coverVersion, status: next, version: { increment: 1 } } });
    if (result.count !== 1) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before changing the cover.");
    const note = job.status === "PUBLISHED" ? "Published posting returned to draft after a cover change" : coverVersion ? "Cover photo changed" : "Cover photo removed";
    await history(tx, job.id, actor.user.id, job.status, next, "edited", note);
    if (job.status === "PUBLISHED") await tx.outboxEvent.create({ data: { deduplicationKey: `job:${job.id}:${version + 1}:edited`, kind: "job.updated", aggregateId: job.id } });
    return tx.job.findUniqueOrThrow({ where: { id: job.id } });
  });
}
export async function setJobCover(db: PrismaClient, actor: Actor, id: string, version: number, bytes: Buffer, store: ImageStore = defaultImageStore()) {
  checkImage(bytes, "job-covers");
  const job = await coverTarget(db, actor, id, version);
  const uploaded = await store.upload(imagePublicId("job-covers", job.id, store.folder), bytes, "job-covers");
  return saveCover(db, actor, job, version, uploaded.version);
}
export async function removeJobCover(db: PrismaClient, actor: Actor, id: string, version: number, store: ImageStore = defaultImageStore()) {
  const job = await coverTarget(db, actor, id, version);
  if (!job.coverVersion) throw new AccessError(404, "NOT_FOUND", "This posting has no cover photo");
  const saved = await saveCover(db, actor, job, version, null);
  await store.remove(imagePublicId("job-covers", job.id, store.folder)).catch(() => undefined);
  return saved;
}

// Administrators can change a job's application fee before it's approved, without sending it back to draft.
// The change is recorded in the job's history, which the recruiter sees.
export async function setJobFee(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  assertAdmin(actor);
  const data = z.object({ version: z.number().int().positive(), applicationFeeKes: feeKes }).strict().parse(input);
  return db.$transaction(async tx => {
    const job = await scopedJob(tx, actor, id);
    if (!["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW"].includes(job.status)) throw new AccessError(409, "INVALID_JOB_STATE", "The fee can only be changed before the job is approved");
    if (job.version !== data.version) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before changing the fee.");
    const amount = data.applicationFeeKes * 100;
    if (amount === job.applicationFeeMinor) return job;
    if (await tx.application.count({ where: { jobId: id } })) throw new AccessError(409, "FEE_LOCKED", "The fee cannot change after an application has been started");
    const result = await tx.job.updateMany({ where: { id, version: data.version }, data: { applicationFeeMinor: amount, version: { increment: 1 } } });
    if (result.count !== 1) throw new AccessError(409, "STALE_JOB", "This job changed. Reload the latest version before changing the fee.");
    await history(tx, id, actor.user.id, job.status, job.status, "fee_changed", `Application fee changed from ${formatFee(job.applicationFeeMinor)} to ${formatFee(amount)} by KBO`);
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
    if (job.recruiter.status !== "ACTIVE" && !["close", "archive"].includes(data.action)) throw suspendedRecruiter();
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
  const job = await db.job.findFirst({ where: { id, ...managedScope(actor) }, include: { recruiter: { select: { id: true, name: true, email: true, status: true, role: true, avatarVersion: true, recruiterVerifiedAt: true } }, history: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } } } });
  if (!job) throw new AccessError(404, "NOT_FOUND", "Job not found");
  return { ...job, recruiter: asEmployer(job.recruiter) };
}

const statusRank: Record<JobStatus, number> = { PENDING_REVIEW: 0, PUBLISHED: 1, DRAFT: 2, CHANGES_REQUESTED: 3, CLOSED: 4, ARCHIVED: 5 };
export async function listManagedJobs(db: PrismaClient, actor: Actor, input: unknown) {
  const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.enum(["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(), recruiterId: z.string().max(100).optional() }).strict().parse(input);
  // Filters are ANDed with the ownership scope so a recruiter can never widen it (e.g. by passing another recruiterId).
  const where: Prisma.JobWhereInput = { AND: [managedScope(actor), query.status ? { status: query.status } : {}, query.recruiterId ? { recruiterId: query.recruiterId } : {}] };
  // With no status filter, jobs needing attention come first: awaiting review, then live, then drafts, and returned,
  // closed and archived last (newest first within each). Job counts are small, so the order is worked out on ids.
  let pageWhere: Prisma.JobWhereInput = where, skip = (query.page - 1) * 20, pageIds: string[] | null = null;
  if (!query.status) {
    const all = await db.job.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { id: true, status: true } });
    pageIds = all.map((job, index) => ({ job, index })).sort((a, b) => statusRank[a.job.status] - statusRank[b.job.status] || a.index - b.index).slice(skip, skip + 20).map(({ job }) => job.id);
    pageWhere = { AND: [where, { id: { in: pageIds } }] }; skip = 0;
  }
  const [total, rows] = await db.$transaction([
    db.job.count({ where }), db.job.findMany({ where: pageWhere, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: 20, select: { id: true, title: true, slug: true, status: true, version: true, deadline: true, applicationFeeMinor: true, coverVersion: true, category: true, employmentType: true, location: true, description: true, recruiter: { select: { id: true, name: true, role: true, avatarVersion: true, recruiterVerifiedAt: true } }, _count: { select: { applications: { where: paidSubmission } } },
      // The newest applicants' photos for the card; the applicants popup loads the full list.
      applications: { where: paidSubmission, select: { user: { select: { id: true, name: true, avatarVersion: true } } }, orderBy: [{ submittedAt: "desc" }, { id: "asc" }], take: 4 } } }),
  ]);
  const jobs = pageIds ? [...rows].sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id)) : rows;
  // Applications nobody has looked at yet ("new"), per job.
  const fresh = jobs.length ? await db.application.groupBy({ by: ["jobId"], where: { ...paidSubmission, status: "SUBMITTED", jobId: { in: jobs.map(job => job.id) } }, _count: { _all: true } }) : [];
  const newCount = new Map(fresh.map(row => [row.jobId, row._count._all]));
  return { jobs: jobs.map(({ applications, description, ...job }) => ({ ...job, recruiter: asEmployer(job.recruiter), summary: description.slice(0, 160), newApplicants: newCount.get(job.id) ?? 0, recentApplicants: applications.map(application => application.user) })), pagination: { page: query.page, total, pageCount: Math.ceil(total / 20) } };
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
