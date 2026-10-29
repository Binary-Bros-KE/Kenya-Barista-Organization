import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { getDashboardOverview } from "../src/server/dashboard-overview";

test("dashboard overview preserves ownership, CV status and administrator MFA boundaries", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID(), users: string[] = [];
  let organisationId = "";
  async function actor(name: string, admin = false): Promise<Actor> {
    const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, role: admin ? "ADMIN" : "APPLICANT" } });
    users.push(user.id); return { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
  }
  try {
    const owner = await actor("overview-owner"), other = await actor("overview-other"), admin = await actor("overview-admin", true);
    const organisation = await db.organisation.create({ data: { name: "Overview coffee team", slug: "overview-" + suffix } }); organisationId = organisation.id;
    await db.organisationMember.create({ data: { userId: owner.user.id, organisationId, role: "RECRUITER" } });
    const job = await db.job.create({ data: { organisationId, title: "Coffee professional", slug: "overview-job-" + suffix, description: "Fixture", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", applicationFeeMinor: 10000, status: "PUBLISHED", publishedAt: new Date(), deadline: new Date(Date.now() + 86400000) } });
    await db.job.create({ data: { organisationId, title: "Private pending job", slug: "overview-pending-" + suffix, description: "Fixture", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", applicationFeeMinor: 10000, status: "PENDING_REVIEW", deadline: new Date(Date.now() + 86400000) } });
    const own = await db.application.create({ data: { userId: owner.user.id, jobId: job.id, applicationFeeMinor: 10000 } });
    const submitted = await db.application.create({ data: { userId: other.user.id, jobId: job.id, applicationFeeMinor: 10000, status: "SUBMITTED", submittedAt: new Date() } });
    await db.paymentOrder.create({ data: { applicationId: submitted.id, amountMinor: 10000, status: "SUCCEEDED", paidAt: new Date() } });
    await db.notification.createMany({ data: [
      { userId: owner.user.id, kind: "OVERVIEW_FIXTURE", title: "Your application update", audience: "APPLICANT", applicationId: own.id, href: "/dashboard/applications/" + own.id },
      { userId: other.user.id, kind: "OVERVIEW_FIXTURE", title: "Other user's private update", audience: "APPLICANT", applicationId: submitted.id, href: "/dashboard/applications/" + submitted.id },
      { userId: admin.user.id, kind: "OVERVIEW_FIXTURE", title: "Private administrator update", audience: "ADMIN", href: "/admin/jobs" },
    ] });
    await db.document.createMany({ data: [
      { userId: owner.user.id, storageKey: "overview-pending-" + suffix, filename: "pending.pdf", mimeType: "application/pdf", sizeBytes: 100, scanStatus: "PENDING" },
      { userId: other.user.id, storageKey: "overview-other-" + suffix, filename: "other.pdf", mimeType: "application/pdf", sizeBytes: 100, scanStatus: "CLEAN" },
    ] });
    await t.test("personal summaries include only owned applications, updates and screened CVs", async () => {
      const data = await getDashboardOverview(db, owner);
      assert.deepEqual(data.counts, { applications: 1, drafts: 1, active: 0, unread: 1 });
      assert.equal(data.applications[0].id, own.id); assert.equal(data.applications.length, 1);
      assert.deepEqual(data.notifications.map(item => item.title), ["Your application update"]);
      assert.equal(data.cleanCvs, 0); assert.equal(data.memberships, 1); assert.equal(data.platform, null);
    });
    await t.test("profile readiness follows validation and pending CVs do not count as screened", async () => {
      assert.equal((await getDashboardOverview(db, owner)).profileReady, false);
      await db.applicantProfile.create({ data: { userId: owner.user.id, fullName: "Coffee Professional", phone: "+254712345678", location: "Nairobi", summary: "" } });
      await db.document.create({ data: { userId: owner.user.id, storageKey: "overview-clean-" + suffix, filename: "clean.pdf", mimeType: "application/pdf", sizeBytes: 100, scanStatus: "CLEAN" } });
      const data = await getDashboardOverview(db, owner); assert.equal(data.profileReady, true); assert.equal(data.cleanCvs, 1);
    });
    await t.test("administrator role alone cannot reveal platform totals or administrator updates", async () => {
      const data = await getDashboardOverview(db, admin);
      assert.equal(data.adminVerified, false); assert.equal(data.platform, null); assert.equal(data.counts.unread, 0); assert.deepEqual(data.notifications, []);
      const enabled = await db.user.update({ where: { id: admin.user.id }, data: { twoFactorEnabled: true } });
      assert.equal((await getDashboardOverview(db, { ...admin, user: enabled })).platform, null);
      admin.user = enabled;
    });
    await t.test("only a verified administrator session receives the review queue and confirmed submission total", async () => {
      const verified = { ...admin, session: { ...admin.session, mfaVerifiedAt: new Date() } };
      const data = await getDashboardOverview(db, verified);
      assert.equal(data.adminVerified, true); assert.equal(data.platform?.pendingJobs, 1); assert.equal(data.platform?.submissions, 1);
      assert.equal(data.platform?.jobs[0].title, "Private pending job"); assert.equal(data.notifications[0].title, "Private administrator update");
      const nonAdminWithMfa = { ...owner, user: { ...owner.user, twoFactorEnabled: true }, session: { ...owner.session, mfaVerifiedAt: new Date() } };
      assert.equal((await getDashboardOverview(db, nonAdminWithMfa)).platform, null);
    });
    await t.test("suspended or unverified actors are rejected", async () => {
      await assert.rejects(getDashboardOverview(db, { ...owner, user: { ...owner.user, status: "SUSPENDED" } }), { status: 403 });
      await assert.rejects(getDashboardOverview(db, { ...owner, user: { ...owner.user, emailVerified: false } }), { status: 403 });
    });
  } finally {
    if (users.length) {
      await db.notification.deleteMany({ where: { userId: { in: users } } });
      await db.document.deleteMany({ where: { userId: { in: users } } });
      await db.paymentOrder.deleteMany({ where: { application: { userId: { in: users } } } });
      await db.application.deleteMany({ where: { userId: { in: users } } });
      await db.applicantProfile.deleteMany({ where: { userId: { in: users } } });
      await db.organisationMember.deleteMany({ where: { userId: { in: users } } });
    }
    if (organisationId) { await db.job.deleteMany({ where: { organisationId } }); await db.organisation.delete({ where: { id: organisationId } }); }
    if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
