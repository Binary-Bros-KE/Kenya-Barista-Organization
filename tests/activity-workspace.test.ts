import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { Actor } from "../src/server/access";
import { applicantPayments } from "../src/server/applicant-payments";
import { historyQuery, historyHref, paymentLabel } from "../src/lib/payment-view";
import { PaymentHistory } from "../src/components/payment-history";
import { NotificationInbox } from "../src/components/notification-inbox";
import { PaymentCheckout } from "../src/components/payment-checkout";
function render(component: ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never }, component)); }
test("payment queries validate filters, clamp pages and retain status on pagination", () => {
 for (const status of ["__proto__", "toString", "INVALID"]) assert.equal(historyQuery({ status }).status, undefined);
 assert.deepEqual(historyQuery({ page: "-1", status: "REFUNDED" }), { page: 1, status: "REFUNDED" });
 assert.equal(historyQuery({ page: "Infinity" }).page, 1); assert.equal(historyQuery({ page: "999999" }).page, 100000);
 assert.equal(historyHref(2, "REFUNDED"), "/dashboard/payments?status=REFUNDED&page=2");
 assert.equal(paymentLabel("REFUNDED"), "Reversed");
});
test("payment rows, filtered total and summary counts preserve ownership and exclude private provider evidence", async () => {
 const calls: Record<string, any> = {};
 const db = { paymentOrder: { findMany: async (q: unknown) => { calls.rows = q; return []; }, count: async (q: unknown) => { calls.total = q; return 0; }, groupBy: async (q: unknown) => { calls.groups = q; return [{ status: "PENDING", _count: { _all: 2 } }]; } } } as unknown as PrismaClient;
 const result = await applicantPayments(db, { user: { id: "owner" } } as Actor, { status: "PENDING", page: "2" });
 assert.deepEqual(calls.rows.where, { application: { userId: "owner" }, status: "PENDING" }); assert.deepEqual(calls.total.where, calls.rows.where);
 assert.deepEqual(calls.groups.where, { application: { userId: "owner" } }); assert.equal(calls.rows.skip, 20);
 assert.deepEqual(calls.rows.select.attempts.select, { receiptNumber: true }); assert.deepEqual(calls.rows.select.refunds.where, { status: "COMPLETED" });
 assert.deepEqual(result.counts, { PENDING: 2 });
});
test("payment history shows recorded manual reversals, honest missing receipts and retained pagination", () => {
 const html = render(createElement(PaymentHistory, { result: { orders: [{ id: "pay", status: "REFUNDED", reviewHold: false, amountMinor: 10000, createdAt: new Date("2026-10-29T10:00:00Z"), paidAt: null, attempts: [], refunds: [{ id: "refund", providerReference: "manual-ref", completedAt: new Date("2026-10-29T11:00:00Z") }], application: { id: "app", job: { title: "Barista", organisation: { name: "Coffee Co" } } } }], total: 42, counts: { REFUNDED: 42 }, page: 2, status: "REFUNDED" } }));
 for (const value of ["Manual reversal recorded", "manual-ref", "Not available yet", "Reversed", "status=REFUNDED&amp;page=3"]) assert.ok(html.includes(value), value);
 assert.ok(html.includes('href="/dashboard/applications/app"'));
});
test("reversed checkout never claims the fee is confirmed and cannot request another payment", () => {
 const html = render(createElement(PaymentCheckout, { applicationId: "a", version: 1, amountMinor: 10000, phone: "", options: [], status: "REFUNDED", applicationStatus: "SUBMITTED", receipt: "receipt", reviewReason: null }));
 assert.ok(html.includes('manual reversal')); assert.ok(!html.includes('Your application fee is confirmed'));
 assert.ok(!html.includes('Pay and submit application')); assert.ok(html.includes('View payment history'));
});
test("pending checkout prevents repeat payment and preserves manual status checking", () => {
 const html = render(createElement(PaymentCheckout, { applicationId: "a", version: 1, amountMinor: 10000, phone: "", options: [], status: "PENDING", applicationStatus: "DRAFT", receipt: null, reviewReason: null }));
 assert.ok(!html.includes('Pay and submit application')); assert.ok(html.includes('Check payment status'));
});
test("notification inbox escapes content, distinguishes read state and retains unread pagination", () => {
 const html = render(createElement(NotificationInbox, { enabled: false, unread: true, result: { notifications: [{ id: "n", title: "<script>title</script>", body: "<img onerror=alert(1)>", href: "/dashboard/applications/a", readAt: null, createdAt: new Date("2026-10-29T10:00:00Z") }], unread: 42, pagination: { page: 2, total: 42, pageCount: 3 } } }));
 assert.ok(html.includes('&lt;script&gt;title&lt;/script&gt;')); assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));
 assert.ok(html.includes('Mark as read')); assert.ok(html.includes('unread=true&amp;page=3'));
 assert.ok(html.includes('Dashboard alerts remain available')); assert.ok(!/<input[^>]*checked=""/.test(html));
});
test("read notifications have no mark-read action and unread empty states stay honest", () => {
 const result = { notifications: [{ id: "n", title: "Update", body: "Body", href: "/dashboard", readAt: new Date(), createdAt: new Date() }], unread: 0, pagination: { page: 1, total: 1, pageCount: 1 } };
 const html = render(createElement(NotificationInbox, { enabled: true, unread: false, result })); assert.ok(!html.includes('>Mark as read</button>'));
 const empty = render(createElement(NotificationInbox, { enabled: true, unread: true, result: { ...result, notifications: [], pagination: { page: 1, total: 0, pageCount: 0 } } })); assert.ok(empty.includes("all caught up"));
});

test("checkout phone pattern accepts optional plus and both Kenyan mobile prefixes", () => {
 const html = render(createElement(PaymentCheckout, { applicationId: "a", version: 1, amountMinor: 10000, phone: "", options: [], status: null, applicationStatus: "DRAFT", receipt: null, reviewReason: null }));
 const pattern = /pattern="([^"]+)"/.exec(html)?.[1]; assert.ok(pattern);
 const regex = new RegExp("^(?:" + pattern + ")$");
 for (const phone of ["+254712345678", "254712345678", "+254112345678"]) assert.ok(regex.test(phone), phone);
 for (const phone of ["0712345678", "+254712", "wrong"]) assert.ok(!regex.test(phone), phone);
});
