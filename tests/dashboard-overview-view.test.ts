import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardOverview } from "../src/components/dashboard-overview";
import type { DashboardOverviewData } from "../src/server/dashboard-overview";

const empty: DashboardOverviewData = { counts: { applications: 0, drafts: 0, active: 0, unread: 0 }, profileReady: false, cleanCvs: 0, adminVerified: false, recruiterRequest: null, recruiterVerified: false, applications: [], notifications: [], recruiting: null, platform: null };
const user = { name: "Coffee Professional", email: "coffee@example.invalid", role: "APPLICANT" as const, emailVerified: true, twoFactorEnabled: false };
test("new applicants see honest empty states, profile actions and optional security", () => {
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data: empty, user, now: new Date("2026-10-29T22:00:00Z") }));
  assert.ok(html.includes("No applications yet")); assert.ok(html.includes("No updates yet"));
  assert.ok(html.includes('href="/dashboard/profile"')); assert.ok(html.includes("optional two-factor protection"));
  assert.ok(html.includes("30 October 2026"), "Dates use Nairobi time");
  assert.ok(!html.includes("Platform at a glance")); assert.ok(html.includes("Friday, 30 October 2026")); assert.ok(html.includes('aria-valuenow="1"'));
});
test("administrators open on stat cards with administrative shortcuts only", () => {
  const data = { ...empty, adminVerified: true, platform: { members: 12, recruiters: 3, pendingJobs: 0, submissions: 7, liveJobs: 5, jobs: [] } };
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data, user: { ...user, role: "ADMIN" }, now: new Date("2026-11-14T13:00:00Z") }));
  assert.ok(html.indexOf("overview-stat") < html.indexOf("overview-grid"), "Stat cards come first");
  assert.ok(html.includes('aria-label="Verified members: 12"')); assert.ok(html.includes('aria-label="Live jobs: 5"'));
  assert.equal((html.match(/class="overview-stat overview-stat-/g) || []).length, 4, "One row of four cards");
  assert.ok(html.includes("Good afternoon, Coffee")); assert.ok(html.includes("The review queue is clear"));
  assert.ok(!html.includes('href="/dashboard/profile"')); assert.ok(!html.includes("Account essentials")); assert.ok(!html.includes("Verify 2FA"));
});
test("recruiters get recruiting cards, their latest applicants and jobs needing attention", () => {
  const recruiting = { liveJobs: 3, newApplicants: 5, awaitingApproval: 1, changesRequested: 2,
    applicants: [{ id: "ap1", name: "Wanjiru Kamau", status: "SUBMITTED" as const, title: "Head Barista", submittedAt: new Date("2026-11-14T09:00:00Z") }],
    jobs: [{ id: "j1", title: "Roaster", status: "CHANGES_REQUESTED" as const, updatedAt: new Date("2026-11-13T09:00:00Z") }] };
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data: { ...empty, recruiting }, user: { ...user, role: "RECRUITER" as const } }));
  assert.ok(html.includes('aria-label="New applicants: 5"')); assert.ok(html.includes('aria-label="Changes requested: 2"'));
  assert.ok(html.includes("Wanjiru Kamau")); assert.ok(html.includes('href="/employer/applications/ap1"'));
  assert.ok(html.includes("Jobs needing attention")); assert.ok(html.includes('href="/employer/jobs/j1"')); assert.ok(html.includes('href="/employer/jobs/new"'));
  assert.ok(!html.includes("Account essentials"), "No job-seeker checklist for recruiters");
});
