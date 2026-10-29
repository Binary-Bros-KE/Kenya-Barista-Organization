import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardOverview } from "../src/components/dashboard-overview";
import type { DashboardOverviewData } from "../src/server/dashboard-overview";

const empty: DashboardOverviewData = { counts: { applications: 0, drafts: 0, active: 0, unread: 0 }, profileReady: false, cleanCvs: 0, memberships: 0, adminVerified: false, applications: [], notifications: [], platform: null };
const user = { name: "Coffee Professional", email: "coffee@example.invalid", role: "APPLICANT" as const, emailVerified: true, twoFactorEnabled: false };
test("new applicants see honest empty states, profile actions and optional security", () => {
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data: empty, user, now: new Date("2026-10-29T22:00:00Z") }));
  assert.ok(html.includes("No applications yet")); assert.ok(html.includes("No updates yet"));
  assert.ok(html.includes('href="/dashboard/profile"')); assert.ok(html.includes("optional two-factor protection"));
  assert.ok(html.includes("30 October 2026"), "Dates use Nairobi time");
  assert.ok(!html.includes("Platform summary")); assert.ok(html.includes('aria-valuenow="1"'));
});
test("unverified administrator sessions see locked totals and the security route", () => {
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data: empty, user: { ...user, role: "ADMIN" } }));
  assert.ok(html.includes("Verify 2FA")); assert.ok(html.includes("Your review queue is protected"));
  assert.ok(html.includes("verification required")); assert.ok(html.includes('href="/dashboard/security"'));
  assert.ok(!html.includes("The review queue is clear"), "Locked is not an empty queue");
});
test("verified administrator summaries use actual counts and show the real queue state", () => {
  const data = { ...empty, adminVerified: true, platform: { members: 12, organisations: 3, pendingJobs: 0, submissions: 7, jobs: [] } };
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data, user: { ...user, role: "ADMIN", twoFactorEnabled: true } }));
  assert.ok(html.includes('aria-label="Verified members: 12"')); assert.ok(html.includes('aria-label="Submitted applications: 7"'));
  assert.ok(html.includes("The review queue is clear")); assert.ok(!html.includes("Verify 2FA"));
});
