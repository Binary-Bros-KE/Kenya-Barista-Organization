import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { recruiterQuery, listRecruiters, recruiterDetail, type RecruiterList } from "../src/server/admin-recruiters";
import { setAccountType } from "../src/server/employers";
import { AdminRecruiters } from "../src/components/admin-recruiters";

const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never;
function render(data: RecruiterList) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(PathnameContext.Provider, { value: "/admin" }, createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, createElement(AdminRecruiters, { data })))));
}

test("recruiter filters fall back to safe defaults", () => {
  assert.deepEqual(recruiterQuery.parse({}), { q: "", status: "all", sort: "newest", page: 1 });
  assert.deepEqual(recruiterQuery.parse({ status: "no-jobs", sort: "bogus", q: [" java "] }), { q: "java", status: "no-jobs", sort: "newest", page: 1 });
});

test("recruiters page opens with stat cards, an add button and one row per recruiter account", () => {
  const data: RecruiterList = {
    query: recruiterQuery.parse({}), stats: { total: 14, active: 13, suspended: 1, liveJobs: 9, pendingJobs: 3, applications: 61, noJobs: 2, verified: 10, pendingRequests: 3 },
    pagination: { page: 1, matching: 2, pageCount: 1 }, activity: [],
    recruiters: [
      { id: "a", name: "Java House HR", email: "hr@java.co.ke", avatarVersion: null, suspended: false, verified: true, createdAt: new Date("2026-09-01"), lastSignInAt: new Date(), liveJobs: 3, totalJobs: 4, applications: 12 },
      { id: "b", name: "Bean Lab", email: "jobs@beanlab.co.ke", avatarVersion: null, suspended: true, verified: false, createdAt: new Date("2026-10-01"), lastSignInAt: null, liveJobs: 0, totalJobs: 0, applications: 0 },
    ],
  };
  const html = render(data);
  assert.ok(html.indexOf("overview-stat") < html.indexOf("accounts-toolbar"), "Stat cards come first");
  assert.ok(html.includes("Recruiters: 14")); assert.ok(html.includes("13 active · 1 suspended"));
  assert.ok(html.includes("Requests (3)")); assert.ok(html.includes("4 still to verify")); assert.ok(html.includes("Verified recruiter")); assert.ok(html.includes("Java House HR")); assert.ok(html.includes("hr@java.co.ke"));
  assert.ok(html.includes("No jobs yet")); assert.ok(html.includes("Suspended")); assert.ok(!/organisation|company/i.test(html), "No company concepts remain");
  assert.ok(html.includes('href="/employer/applications"'));
});

test("recruiter listing filters, counts and details real records", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID().slice(0, 8), users: string[] = [];
  const make = async (name: string, data: Record<string, unknown> = {}) => { const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, ...data } }); users.push(user.id); return user; };
  try {
    const adminUser = await make("rec-admin", { role: "ADMIN" });
    const admin: Actor = { user: adminUser, session: { id: randomUUID(), mfaVerifiedAt: null } };
    const busy = await make("rec-busy", { lastSignInAt: new Date() });
    const idle = await make("rec-idle", { role: "RECRUITER", status: "SUSPENDED" });
    const seeker = await make("rec-seeker");

    assert.equal((await setAccountType(db, admin, { email: busy.email.toUpperCase(), role: "RECRUITER" })).role, "RECRUITER");
    const job = await db.job.create({ data: { recruiterId: busy.id, title: "Head Barista", slug: `rec-job-${suffix}`, description: "Fixture", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", applicationFeeMinor: 10000, status: "PUBLISHED", deadline: new Date(Date.now() + 864000000) } });
    await db.application.create({ data: { userId: seeker.id, jobId: job.id, status: "SUBMITTED", submittedAt: new Date(), applicationFeeMinor: 10000 } });

    await assert.rejects(listRecruiters(db, { user: seeker, session: { id: randomUUID(), mfaVerifiedAt: null } }, {}), { status: 403 });
    const mine = (list: RecruiterList) => list.recruiters.map(r => r.email).filter(e => e.endsWith(`${suffix}@example.invalid`)).map(e => e.split("-" + suffix)[0]);
    const all = await listRecruiters(db, admin, { q: suffix });
    assert.deepEqual(mine(all).sort(), ["rec-busy", "rec-idle"], "Only recruiter accounts are listed");
    const row = all.recruiters.find(r => r.id === busy.id)!;
    assert.equal(row.liveJobs, 1); assert.equal(row.totalJobs, 1); assert.equal(row.applications, 1); assert.ok(row.lastSignInAt);
    assert.deepEqual(mine(await listRecruiters(db, admin, { q: suffix, status: "suspended" })), ["rec-idle"]);
    assert.deepEqual(mine(await listRecruiters(db, admin, { q: suffix, status: "unverified" })).sort(), ["rec-busy", "rec-idle"]);
    assert.deepEqual(mine(await listRecruiters(db, admin, { q: suffix, status: "no-jobs" })), ["rec-idle"]);
    assert.deepEqual(mine(await listRecruiters(db, admin, { q: suffix, sort: "jobs" }))[0], "rec-busy");

    const detail = await recruiterDetail(db, admin, busy.id);
    assert.equal(detail.jobs[0].applications, 1); assert.ok(detail.audit.some(entry => entry.action === "account.made_recruiter"));
    await assert.rejects(recruiterDetail(db, admin, seeker.id), { status: 404 }, "Job seekers are not recruiters");
    await setAccountType(db, admin, { userId: busy.id, role: "APPLICANT" });
    assert.deepEqual(mine(await listRecruiters(db, admin, { q: suffix })), ["rec-idle"], "Changing back to job seeker removes them from the list");
  } finally {
    await db.application.deleteMany({ where: { userId: { in: users } } });
    await db.job.deleteMany({ where: { recruiterId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
