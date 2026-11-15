import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";

// Recruiters are accounts with the RECRUITER type. Each one owns the jobs they post.
export const RECRUITERS_PER_PAGE = 25;
const one = (value: unknown) => Array.isArray(value) ? value[0] : value;
export const recruiterQuery = z.object({
  q: z.preprocess(one, z.string().trim().max(100).catch("")).default(""),
  status: z.preprocess(one, z.enum(["all", "verified", "unverified", "suspended", "no-jobs"]).catch("all")).default("all"),
  sort: z.preprocess(one, z.enum(["newest", "oldest", "name", "jobs", "active"]).catch("newest")).default("newest"),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(100000).catch(1)).default(1),
});
export type RecruiterQuery = z.infer<typeof recruiterQuery>;

const submitted = { submittedAt: { not: null } };
const recruiters: Prisma.UserWhereInput = { role: "RECRUITER" };

function recruiterWhere(query: RecruiterQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [recruiters];
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { email: contains }] });
  }
  if (query.status === "verified") and.push({ recruiterVerifiedAt: { not: null } });
  if (query.status === "unverified") and.push({ recruiterVerifiedAt: null });
  if (query.status === "suspended") and.push({ status: "SUSPENDED" });
  if (query.status === "no-jobs") and.push({ recruiterJobs: { none: {} } });
  return { AND: and };
}
const orderBy: Record<RecruiterQuery["sort"], Prisma.UserOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  name: [{ name: { sort: "asc", nulls: "last" } }, { email: "asc" }],
  jobs: [{ recruiterJobs: { _count: "desc" } }, { id: "asc" }],
  active: [{ lastSignInAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
};

export async function listRecruiters(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const query = recruiterQuery.parse(input);
  const where = recruiterWhere(query);
  const [total, matching, rows, active, suspended, liveJobs, pendingJobs, applications, noJobs, activity, verified, pendingRequests] = await Promise.all([
    db.user.count({ where: recruiters }),
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: orderBy[query.sort], skip: (query.page - 1) * RECRUITERS_PER_PAGE, take: RECRUITERS_PER_PAGE,
      select: { id: true, name: true, email: true, status: true, createdAt: true, lastSignInAt: true, recruiterVerifiedAt: true, _count: { select: { recruiterJobs: { where: { status: "PUBLISHED" } } } } },
    }),
    db.user.count({ where: { ...recruiters, status: "ACTIVE" } }),
    db.user.count({ where: { ...recruiters, status: "SUSPENDED" } }),
    db.job.count({ where: { status: "PUBLISHED", recruiter: { status: "ACTIVE" } } }),
    db.job.count({ where: { status: "PENDING_REVIEW", recruiter: { status: "ACTIVE" } } }),
    db.application.count({ where: submitted }),
    db.user.count({ where: { ...recruiters, recruiterJobs: { none: {} } } }),
    db.auditLog.findMany({ select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.user.count({ where: { ...recruiters, recruiterVerifiedAt: { not: null } } }),
    db.recruiterRequest.count({ where: { status: "PENDING" } }),
  ]);
  const ids = rows.map(row => row.id);
  const jobs = ids.length ? await db.job.findMany({ where: { recruiterId: { in: ids } }, select: { recruiterId: true, _count: { select: { applications: { where: submitted } } } } }) : [];
  const totals = new Map<string, { jobs: number; applications: number }>();
  for (const job of jobs) {
    const current = totals.get(job.recruiterId) ?? { jobs: 0, applications: 0 };
    totals.set(job.recruiterId, { jobs: current.jobs + 1, applications: current.applications + job._count.applications });
  }
  return {
    query,
    stats: { total, active, suspended, liveJobs, pendingJobs, applications, noJobs, verified, pendingRequests },
    pagination: { page: query.page, matching, pageCount: Math.max(1, Math.ceil(matching / RECRUITERS_PER_PAGE)) },
    recruiters: rows.map(row => ({
      id: row.id, name: row.name, email: row.email, suspended: row.status === "SUSPENDED", verified: !!row.recruiterVerifiedAt, createdAt: row.createdAt, lastSignInAt: row.lastSignInAt,
      liveJobs: row._count.recruiterJobs, totalJobs: totals.get(row.id)?.jobs ?? 0, applications: totals.get(row.id)?.applications ?? 0,
    })),
    activity: activity.map(entry => ({ id: entry.id, action: entry.action, entityType: entry.entityType, createdAt: entry.createdAt, by: entry.actor?.name || entry.actor?.email || "System" })),
  };
}
export type RecruiterList = Awaited<ReturnType<typeof listRecruiters>>;

export async function recruiterDetail(db: PrismaClient, actor: Actor, id: string) {
  assertAdmin(actor);
  const recruiter = await db.user.findFirst({ where: { id, role: "RECRUITER" }, select: {
    id: true, name: true, email: true, status: true, emailVerified: true, createdAt: true, lastSignInAt: true,
    recruiterVerifiedAt: true, recruiterVerification: true, recruiterVerifiedBy: { select: { name: true, email: true } },
    profile: { select: { phone: true, location: true } },
    recruiterRequests: { where: { status: "APPROVED" }, select: { hiringFor: true, roles: true, phone: true, location: true, website: true, message: true, createdAt: true, reviewedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    recruiterJobs: { select: { id: true, title: true, status: true, deadline: true, updatedAt: true, _count: { select: { applications: { where: submitted } } } }, orderBy: { updatedAt: "desc" }, take: 25 },
  } });
  if (!recruiter) throw new AccessError(404, "NOT_FOUND", "Recruiter not found");
  const audit = await db.auditLog.findMany({
    where: { OR: [{ entityType: "User", entityId: id }, { entityType: "Job", entityId: { in: recruiter.recruiterJobs.map(job => job.id) } }] },
    select: { id: true, action: true, createdAt: true, actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 12,
  });
  const { recruiterJobs, recruiterRequests, recruiterVerification, recruiterVerifiedBy, ...rest } = recruiter;
  const verification = recruiterVerification as { checks?: string[]; note?: string } | null;
  return {
    ...rest,
    request: recruiterRequests[0] ?? null,
    verification: recruiter.recruiterVerifiedAt ? { at: recruiter.recruiterVerifiedAt, by: recruiterVerifiedBy?.name || recruiterVerifiedBy?.email || "An administrator", checks: verification?.checks ?? [], note: verification?.note ?? "" } : null,
    jobs: recruiterJobs.map(job => ({ id: job.id, title: job.title, status: job.status, deadline: job.deadline, updatedAt: job.updatedAt, applications: job._count.applications })),
    audit: audit.map(entry => ({ id: entry.id, action: entry.action, createdAt: entry.createdAt, by: entry.actor?.name || entry.actor?.email || "System" })),
  };
}
export type RecruiterDetail = Awaited<ReturnType<typeof recruiterDetail>>;
