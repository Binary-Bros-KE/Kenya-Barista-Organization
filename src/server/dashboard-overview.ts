import type { ApplicationStatus, PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { assertAdmin } from "./access";
import { AccessError } from "./errors";
import { profileInput } from "./applications";
import { listNotifications } from "./notification-access";
import { paidSubmission } from "./submitted-application";

export type DashboardOverviewData = {
  counts: { applications: number; drafts: number; active: number; unread: number };
  profileReady: boolean;
  cleanCvs: number;
  memberships: number;
  adminVerified: boolean;
  applications: { id: string; status: ApplicationStatus; title: string; organisation: string; updatedAt: Date; responses: number }[];
  notifications: { id: string; title: string; href: string; readAt: Date | null; createdAt: Date }[];
  platform: null | {
    members: number; organisations: number; pendingJobs: number; submissions: number;
    jobs: { id: string; title: string; organisation: string; updatedAt: Date }[];
  };
};

export async function getDashboardOverview(db: PrismaClient, actor: Actor): Promise<DashboardOverviewData> {
  if (actor.user.status !== "ACTIVE" || !actor.user.emailVerified) throw new AccessError(403, "ACCOUNT_UNAVAILABLE", "Account access unavailable");
  const userId = actor.user.id;
  const [profile, cleanCvs, groups, applications, notifications, memberships] = await Promise.all([
    db.applicantProfile.findUnique({ where: { userId }, select: { fullName: true, phone: true, location: true, summary: true } }),
    db.document.count({ where: { userId, scanStatus: "CLEAN" } }),
    db.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    db.application.findMany({ where: { userId }, select: {
      id: true, status: true, updatedAt: true, _count: { select: { responses: true } },
      job: { select: { title: true, organisation: { select: { name: true } } } },
    }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
    listNotifications(db, actor, { page: 1 }),
    db.organisationMember.count({ where: { userId, organisation: { suspendedAt: null } } }),
  ]);
  const counts = new Map(groups.map(group => [group.status, group._count._all]));
  const adminVerified = actor.user.role === "ADMIN" && actor.user.twoFactorEnabled && !!actor.session.mfaVerifiedAt;
  let platform: DashboardOverviewData["platform"] = null;
  if (adminVerified) {
    assertAdmin(actor);
    const pending = { status: "PENDING_REVIEW" as const, organisation: { suspendedAt: null } };
    const [members, organisations, pendingJobs, submissions, jobs] = await Promise.all([
      db.user.count({ where: { status: "ACTIVE", emailVerified: true } }),
      db.organisation.count({ where: { suspendedAt: null } }),
      db.job.count({ where: pending }),
      db.application.count({ where: paidSubmission }),
      db.job.findMany({ where: pending, select: { id: true, title: true, updatedAt: true, organisation: { select: { name: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
    ]);
    platform = { members, organisations, pendingJobs, submissions, jobs: jobs.map(job => ({ id: job.id, title: job.title, organisation: job.organisation.name, updatedAt: job.updatedAt })) };
  }
  return {
    counts: {
      applications: groups.reduce((total, group) => total + group._count._all, 0), drafts: counts.get("DRAFT") || 0,
      active: (counts.get("SUBMITTED") || 0) + (counts.get("UNDER_REVIEW") || 0) + (counts.get("SHORTLISTED") || 0), unread: notifications.unread,
    },
    profileReady: profileInput.safeParse({ fullName: profile?.fullName || "", phone: profile?.phone || "", location: profile?.location || "", summary: profile?.summary || "" }).success,
    cleanCvs, memberships, adminVerified,
    applications: applications.map(application => ({ id: application.id, status: application.status, title: application.job.title, organisation: application.job.organisation.name, updatedAt: application.updatedAt, responses: application._count.responses })),
    notifications: notifications.notifications.slice(0, 3).map(({ id, title, href, readAt, createdAt }) => ({ id, title, href, readAt, createdAt })),
    platform,
  };
}
