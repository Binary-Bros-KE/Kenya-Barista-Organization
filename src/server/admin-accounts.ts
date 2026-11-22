import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import { profileInput } from "./applications";

const DAY = 86400000;
export const ACCOUNTS_PER_PAGE = 25;

const one = (value: unknown) => Array.isArray(value) ? value[0] : value;
export const accountQuery = z.object({
  q: z.preprocess(one, z.string().trim().max(100).catch("")).default(""),
  status: z.preprocess(one, z.enum(["all", "verified", "unverified", "suspended"]).catch("all")).default("all"),
  type: z.preprocess(one, z.enum(["all", "applicants", "recruiters", "admins"]).catch("all")).default("all"),
  activity: z.preprocess(one, z.enum(["any", "7d", "30d", "dormant", "never"]).catch("any")).default("any"),
  sort: z.preprocess(one, z.enum(["newest", "oldest", "active", "name", "applications"]).catch("newest")).default("newest"),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(100000).catch(1)).default(1),
});
export type AccountQuery = z.infer<typeof accountQuery>;

function accountWhere(query: AccountQuery, now: Date): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { email: contains }, { profile: { is: { fullName: contains } } }, { profile: { is: { phone: contains } } }, { profile: { is: { location: contains } } }] });
  }
  if (query.status === "verified") and.push({ emailVerified: true, status: "ACTIVE" });
  if (query.status === "unverified") and.push({ emailVerified: false });
  if (query.status === "suspended") and.push({ status: "SUSPENDED" });
  if (query.type === "applicants") and.push({ role: "APPLICANT" });
  if (query.type === "recruiters") and.push({ role: "RECRUITER" });
  if (query.type === "admins") and.push({ role: "ADMIN" });
  if (query.activity === "7d") and.push({ lastSignInAt: { gte: new Date(now.getTime() - 7 * DAY) } });
  if (query.activity === "30d") and.push({ lastSignInAt: { gte: new Date(now.getTime() - 30 * DAY) } });
  if (query.activity === "dormant") and.push({ lastSignInAt: { lt: new Date(now.getTime() - 90 * DAY) } });
  if (query.activity === "never") and.push({ lastSignInAt: null });
  return and.length ? { AND: and } : {};
}

const orderBy: Record<AccountQuery["sort"], Prisma.UserOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  active: [{ lastSignInAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  name: [{ name: { sort: "asc", nulls: "last" } }, { email: "asc" }],
  applications: [{ applications: { _count: "desc" } }, { id: "asc" }],
};

export async function listAccounts(db: PrismaClient, actor: Actor, input: unknown, now = new Date()) {
  assertAdmin(actor);
  const query = accountQuery.parse(input);
  const where = accountWhere(query, now);
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const [total, matching, rows, verified, unverified, active30, newThisWeek, suspended, withCv, applied, recruiters] = await Promise.all([
    db.user.count(),
    db.user.count({ where }),
    db.user.findMany({
      where, orderBy: orderBy[query.sort], skip: (query.page - 1) * ACCOUNTS_PER_PAGE, take: ACCOUNTS_PER_PAGE,
      select: {
        id: true, name: true, email: true, role: true, status: true, emailVerified: true, twoFactorEnabled: true, createdAt: true, lastSignInAt: true, avatarVersion: true,
        profile: { select: { fullName: true, phone: true, location: true, summary: true } },
        documents: { where: { scanStatus: "CLEAN" }, select: { id: true }, take: 1 },
        _count: { select: { applications: true, recruiterJobs: true } },
        applications: { where: { submittedAt: { not: null } }, select: { id: true } },
      },
    }),
    db.user.count({ where: { emailVerified: true, status: "ACTIVE" } }),
    db.user.count({ where: { emailVerified: false } }),
    db.user.count({ where: { lastSignInAt: { gte: since(30) } } }),
    db.user.count({ where: { createdAt: { gte: since(7) } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count({ where: { documents: { some: { scanStatus: "CLEAN" } } } }),
    db.user.count({ where: { applications: { some: { submittedAt: { not: null } } } } }),
    db.user.count({ where: { role: "RECRUITER" } }),
  ]);
  return {
    query,
    stats: { total, verified, unverified, active30, newThisWeek, suspended, withCv, applied, recruiters },
    pagination: { page: query.page, matching, pageCount: Math.max(1, Math.ceil(matching / ACCOUNTS_PER_PAGE)) },
    accounts: rows.map(row => ({
      id: row.id, name: row.profile?.fullName || row.name, email: row.email, role: row.role, status: row.status,
      emailVerified: row.emailVerified, twoFactorEnabled: row.twoFactorEnabled, createdAt: row.createdAt, lastSignInAt: row.lastSignInAt, avatarVersion: row.avatarVersion,
      phone: row.profile?.phone || null, location: row.profile?.location || null,
      profileReady: profileInput.safeParse({ fullName: row.profile?.fullName || "", phone: row.profile?.phone || "", location: row.profile?.location || "", summary: row.profile?.summary || "" }).success,
      hasCv: row.documents.length > 0, applications: row._count.applications, submitted: row.applications.length, jobs: row._count.recruiterJobs,
    })),
  };
}
export type AccountList = Awaited<ReturnType<typeof listAccounts>>;

export async function accountDetail(db: PrismaClient, actor: Actor, id: string, now = new Date()) {
  assertAdmin(actor);
  const [user, audit] = await Promise.all([db.user.findUnique({ where: { id }, select: {
    id: true, name: true, email: true, role: true, status: true, emailVerified: true, emailVerifiedAt: true, twoFactorEnabled: true,
    notificationEmails: true, createdAt: true, updatedAt: true, lastSignInAt: true, avatarVersion: true,
    profile: { select: { fullName: true, phone: true, location: true, summary: true, updatedAt: true } },
    documents: { select: { id: true, filename: true, sizeBytes: true, scanStatus: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 },
    applications: { select: {
      id: true, status: true, submittedAt: true, updatedAt: true, applicationFeeMinor: true,
      job: { select: { title: true, recruiter: { select: { name: true } } } },
      paymentOrder: { select: { status: true, amountMinor: true, paidAt: true } },
    }, orderBy: { updatedAt: "desc" }, take: 20 },
    recruiterJobs: { select: { id: true, title: true, status: true, updatedAt: true, _count: { select: { applications: { where: { submittedAt: { not: null } } } } } }, orderBy: { updatedAt: "desc" }, take: 20 },
    sessions: { where: { expiresAt: { gt: now } }, select: { createdAt: true, userAgent: true }, orderBy: { createdAt: "desc" } },
  } }),
    db.auditLog.findMany({ where: { OR: [{ entityType: "User", entityId: id }, { actorId: id }] }, select: { id: true, action: true, createdAt: true, actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  if (!user) throw new AccessError(404, "NOT_FOUND", "Account not found");
  const { sessions, recruiterJobs, ...rest } = user;
  return {
    ...rest,
    jobs: recruiterJobs.map(job => ({ id: job.id, title: job.title, status: job.status, updatedAt: job.updatedAt, applications: job._count.applications })),
    activeSessions: sessions.length, lastDevice: sessions[0]?.userAgent ?? null,
    audit: audit.map(entry => ({ id: entry.id, action: entry.action, createdAt: entry.createdAt, by: entry.actor?.name || entry.actor?.email || "System" })),
  };
}
export type AccountDetail = Awaited<ReturnType<typeof accountDetail>>;
