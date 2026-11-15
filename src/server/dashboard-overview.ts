import type { ApplicationStatus, PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { assertAdmin } from "./access";
import { AccessError } from "./errors";
import { profileInput } from "./applications";
import { listNotifications } from "./notification-access";
import { paidSubmission } from "./submitted-application";
import { managedScope } from "./jobs";
import { recruitmentScope } from "./recruitment";

export type DashboardOverviewData = {
  counts: { applications: number; drafts: number; active: number; unread: number };
  profileReady: boolean;
  cleanCvs: number;
  adminVerified: boolean;
  applications: { id: string; status: ApplicationStatus; title: string; employer: string; updatedAt: Date; responses: number }[];
  notifications: { id: string; title: string; href: string; readAt: Date | null; createdAt: Date }[];
  recruiterRequest: null | { status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"; reviewNote: string | null };
  recruiterVerified: boolean;
  recruiting: null | {
    liveJobs: number; newApplicants: number; awaitingApproval: number; changesRequested: number;
    applicants: { id: string; name: string; status: ApplicationStatus; title: string; submittedAt: Date | null }[];
    jobs: { id: string; title: string; status: "DRAFT" | "PENDING_REVIEW" | "CHANGES_REQUESTED"; updatedAt: Date }[];
  };
  platform: null | {
    members: number; recruiters: number; pendingJobs: number; submissions: number;
    liveJobs: number;
    jobs: { id: string; title: string; employer: string; updatedAt: Date }[];
  };
};

export async function getDashboardOverview(db: PrismaClient, actor: Actor): Promise<DashboardOverviewData> {
  if (actor.user.status !== "ACTIVE" || !actor.user.emailVerified) throw new AccessError(403, "ACCOUNT_UNAVAILABLE", "Account access unavailable");
  const userId = actor.user.id;
  const [profile, cleanCvs, groups, applications, notifications] = await Promise.all([
    db.applicantProfile.findUnique({ where: { userId }, select: { fullName: true, phone: true, location: true, summary: true } }),
    db.document.count({ where: { userId, scanStatus: "CLEAN" } }),
    db.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    db.application.findMany({ where: { userId }, select: {
      id: true, status: true, updatedAt: true, _count: { select: { responses: true } },
      job: { select: { title: true, recruiter: { select: { name: true } } } },
    }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
    listNotifications(db, actor, { page: 1 }),
  ]);
  const counts = new Map(groups.map(group => [group.status, group._count._all]));
  const adminVerified = actor.user.role === "ADMIN";
  let platform: DashboardOverviewData["platform"] = null;
  if (adminVerified) {
    assertAdmin(actor);
    const pending = { status: "PENDING_REVIEW" as const, recruiter: { status: "ACTIVE" as const } };
    const [members, recruiters, pendingJobs, submissions, jobs, liveJobs] = await Promise.all([
      db.user.count({ where: { status: "ACTIVE", emailVerified: true } }),
      db.user.count({ where: { role: "RECRUITER", status: "ACTIVE" } }),
      db.job.count({ where: pending }),
      db.application.count({ where: paidSubmission }),
      db.job.findMany({ where: pending, select: { id: true, title: true, updatedAt: true, recruiter: { select: { name: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
      db.job.count({ where: { status: "PUBLISHED", recruiter: { status: "ACTIVE" } } }),
    ]);
    platform = { members, recruiters, pendingJobs, submissions, liveJobs, jobs: jobs.map(job => ({ id: job.id, title: job.title, employer: job.recruiter.name || "KBO recruiter", updatedAt: job.updatedAt })) };
  }
  let recruiting: DashboardOverviewData["recruiting"] = null;
  if (actor.user.role === "RECRUITER") {
    const scope = managedScope(actor), received = recruitmentScope(actor);
    const [liveJobs, awaitingApproval, changesRequested, newApplicants, applicants, jobs] = await Promise.all([
      db.job.count({ where: { ...scope, status: "PUBLISHED" } }),
      db.job.count({ where: { ...scope, status: "PENDING_REVIEW" } }),
      db.job.count({ where: { ...scope, status: "CHANGES_REQUESTED" } }),
      db.application.count({ where: { ...received, status: "SUBMITTED" } }),
      db.application.findMany({ where: received, select: { id: true, status: true, submittedAt: true, submissionSnapshot: true, job: { select: { title: true } } }, orderBy: [{ submittedAt: "desc" }, { id: "asc" }], take: 5 }),
      db.job.findMany({ where: { ...scope, status: { in: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED"] } }, select: { id: true, title: true, status: true, updatedAt: true }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 5 }),
    ]);
    recruiting = {
      liveJobs, newApplicants, awaitingApproval, changesRequested,
      applicants: applicants.map(row => {
        const snapshot = row.submissionSnapshot as { fullName?: unknown } | null;
        return { id: row.id, name: typeof snapshot?.fullName === "string" ? snapshot.fullName : "Submitted applicant", status: row.status, title: row.job.title, submittedAt: row.submittedAt };
      }),
      jobs: jobs.map(job => ({ id: job.id, title: job.title, status: job.status as "DRAFT" | "PENDING_REVIEW" | "CHANGES_REQUESTED", updatedAt: job.updatedAt })),
    };
  }
  const recruiterRequest = actor.user.role === "APPLICANT" ? await db.recruiterRequest.findFirst({ where: { userId, status: { not: "WITHDRAWN" } }, select: { status: true, reviewNote: true }, orderBy: { createdAt: "desc" } }) : null;
  return {
    recruiterRequest, recruiterVerified: !!actor.user.recruiterVerifiedAt,
    counts: {
      applications: groups.reduce((total, group) => total + group._count._all, 0), drafts: counts.get("DRAFT") || 0,
      active: (counts.get("SUBMITTED") || 0) + (counts.get("UNDER_REVIEW") || 0) + (counts.get("SHORTLISTED") || 0), unread: notifications.unread,
    },
    profileReady: profileInput.safeParse({ fullName: profile?.fullName || "", phone: profile?.phone || "", location: profile?.location || "", summary: profile?.summary || "" }).success,
    cleanCvs, adminVerified,
    applications: applications.map(application => ({ id: application.id, status: application.status, title: application.job.title, employer: application.job.recruiter.name || "KBO recruiter", updatedAt: application.updatedAt, responses: application._count.responses })),
    notifications: notifications.notifications.slice(0, 3).map(({ id, title, href, readAt, createdAt }) => ({ id, title, href, readAt, createdAt })),
    recruiting,
    platform,
  };
}
