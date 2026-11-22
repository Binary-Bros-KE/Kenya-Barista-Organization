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
import { accountQuery, listAccounts, accountDetail, type AccountList } from "../src/server/admin-accounts";
import { AdminAccounts } from "../src/components/admin-accounts";

const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never;
function render(data: AccountList) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(PathnameContext.Provider, { value: "/admin/accounts" }, createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, createElement(AdminAccounts, { data, selfId: "admin" })))));
}

test("account filters fall back to safe defaults for unknown or repeated values", () => {
  assert.deepEqual(accountQuery.parse({}), { q: "", status: "all", type: "all", activity: "any", sort: "newest", page: 1 });
  assert.deepEqual(accountQuery.parse({ q: ["  barista ", "x"], status: "nonsense", type: "recruiters", activity: "7d", sort: "active", page: "-4" }), { q: "barista", status: "all", type: "recruiters", activity: "7d", sort: "active", page: 1 });
});

test("accounts page opens with stat cards and lists each member with status, readiness and last sign-in", () => {
  const data: AccountList = {
    query: accountQuery.parse({}), stats: { total: 40, verified: 30, unverified: 10, active30: 12, newThisWeek: 3, suspended: 1, withCv: 9, applied: 7, recruiters: 2 },
    pagination: { page: 1, matching: 2, pageCount: 1 },
    accounts: [
      { id: "a", name: "Wanjiru Kamau", email: "wanjiru@example.invalid", role: "APPLICANT", status: "ACTIVE", avatarVersion: null, emailVerified: true, twoFactorEnabled: false, createdAt: new Date("2026-10-01"), lastSignInAt: null, phone: null, location: null, profileReady: true, hasCv: true, applications: 3, submitted: 2, jobs: 0 },
      { id: "b", name: null, email: "new@example.invalid", role: "APPLICANT", status: "SUSPENDED", avatarVersion: null, emailVerified: false, twoFactorEnabled: false, createdAt: new Date("2026-11-01"), lastSignInAt: null, phone: null, location: null, profileReady: false, hasCv: false, applications: 0, submitted: 0, jobs: 0 },
    ],
  };
  const html = render(data);
  assert.ok(html.indexOf("overview-stat") < html.indexOf("accounts-toolbar"), "Stat cards come first");
  assert.ok(html.includes("All accounts: 40")); assert.ok(html.includes("+3 joined this week")); assert.ok(html.includes("75% of all accounts"));
  assert.ok(html.includes("Wanjiru Kamau")); assert.ok(html.includes("3/3")); assert.ok(html.includes("Never")); assert.ok(html.includes("Suspended"));
  assert.ok(html.includes("Search by name, email, phone or location")); assert.ok(html.includes("Showing <strong>1–2</strong> of <strong>2</strong> accounts"));
});

test("account listing filters, sorts and details real records", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID().slice(0, 8), users: string[] = [], day = 86400000;
  const make = async (name: string, data: Record<string, unknown> = {}) => { const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, ...data } }); users.push(user.id); return user; };
  try {
    const adminUser = await make("acct-admin", { role: "ADMIN" });
    const admin: Actor = { user: adminUser, session: { id: randomUUID(), mfaVerifiedAt: null } };
    const fresh = await make("acct-fresh", { lastSignInAt: new Date(Date.now() - day) });
    await db.applicantProfile.create({ data: { userId: fresh.id, fullName: "Achieng Fresh", phone: "+254700111222", location: "Kisumu", summary: "Latte art lover." } });
    await make("acct-dormant", { lastSignInAt: new Date(Date.now() - 120 * day) });
    await make("acct-unverified", { emailVerified: false });
    const applicant: Actor = { user: fresh, session: { id: randomUUID(), mfaVerifiedAt: null } };

    await assert.rejects(listAccounts(db, applicant, {}), { status: 403 });
    const mine = (list: Awaited<ReturnType<typeof listAccounts>>) => list.accounts.map(a => a.email).filter(e => e.endsWith(`${suffix}@example.invalid`)).map(e => e.split("-" + suffix)[0]);
    assert.deepEqual(mine(await listAccounts(db, admin, { q: suffix, activity: "7d" })), ["acct-fresh"]);
    assert.deepEqual(mine(await listAccounts(db, admin, { q: suffix, activity: "dormant" })), ["acct-dormant"]);
    assert.deepEqual(mine(await listAccounts(db, admin, { q: suffix, status: "unverified" })), ["acct-unverified"]);
    assert.deepEqual(mine(await listAccounts(db, admin, { q: "Kisumu" })), ["acct-fresh"], "Searches profile location");
    assert.deepEqual(mine(await listAccounts(db, admin, { q: suffix, type: "admins" })), ["acct-admin"]);
    assert.deepEqual(mine(await listAccounts(db, admin, { q: suffix, sort: "active" })).slice(0, 2), ["acct-fresh", "acct-dormant"]);
    await listAccounts(db, admin, { sort: "applications" });

    const detail = await accountDetail(db, admin, fresh.id);
    assert.equal(detail.profile?.location, "Kisumu"); assert.equal(detail.activeSessions, 0); assert.deepEqual(detail.applications, []);
    await assert.rejects(accountDetail(db, admin, "missing"), { status: 404 });
  } finally {
    await db.applicantProfile.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
