import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { Actor } from "../src/server/access";
import { applicationListQuery, applicationListHref, applicationGuidance } from "../src/lib/application-view";
import { applicantApplicationList } from "../src/server/applicant-application-list";
import { ApplicationList } from "../src/components/application-list";
import { ApplicationResponses } from "../src/components/application-responses";
import { DraftForm } from "../src/components/applicant-forms";
import { WithdrawApplication } from "../src/components/recruitment-actions";
function render(component: ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never }, component)); }
test("status filters accept only known statuses and clamp invalid page input", () => {
 assert.deepEqual(applicationListQuery({ page: "-3", status: "DRAFT" }), { page: 1, status: "DRAFT" });
 for (const status of ["toString", "__proto__", "NOT_A_STATUS"]) assert.equal(applicationListQuery({ status }).status, undefined);
 for (const page of ["NaN", "Infinity", "1.5"]) assert.equal(applicationListQuery({ page }).page, 1);
 assert.equal(applicationListQuery({ page: "999999" }).page, 100000);
 assert.equal(applicationListHref(3, "SHORTLISTED"), "/dashboard/applications?status=SHORTLISTED&page=3");
 assert.equal(applicationListHref(1), "/dashboard/applications");
});
test("list, filtered total and all-status summaries retain the applicant ownership boundary", async () => {
 const calls: Record<string, any> = {};
 const db = { application: {
 findMany: async (query: unknown) => { calls.rows = query; return []; },
 count: async (query: unknown) => { calls.total = query; return 0; },
 groupBy: async (query: unknown) => { calls.groups = query; return [{ status: "DRAFT", _count: { _all: 2 } }]; },
 } } as unknown as PrismaClient;
 const result = await applicantApplicationList(db, { user: { id: "owner" } } as Actor, { page: "2", status: "DRAFT" });
 assert.deepEqual(calls.rows.where, { userId: "owner", status: "DRAFT" });
 assert.deepEqual(calls.total.where, calls.rows.where); assert.deepEqual(calls.groups.where, { userId: "owner" });
 assert.equal(calls.rows.skip, 20); assert.equal(calls.rows.take, 20); assert.deepEqual(result.counts, { DRAFT: 2 });
 assert.equal(calls.rows.select.submissionSnapshot, undefined);
});
test("filtered list pagination keeps status and escapes employer-provided text", () => {
 const html = render(createElement(ApplicationList, { items: [{ id: "a", status: "DRAFT", applicationFeeMinor: 10000, updatedAt: new Date("2026-10-29T10:00:00Z"), _count: { responses: 1 }, job: { title: "<script>unsafe</script>", organisation: { name: "Coffee Co" } } }], total: 50, counts: { DRAFT: 50 }, page: 2, status: "DRAFT" }));
 assert.ok(html.includes('status=DRAFT&amp;page=3')); assert.ok(html.includes('href="/dashboard/applications?status=DRAFT"'));
 assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;')); assert.ok(!html.includes('<script>unsafe'));
 assert.ok(html.includes('aria-current="page"')); assert.ok(html.includes('1 response or update'));
});
test("draft editing permits pending CVs for saving but explains the screening gate and excludes rejected CVs", () => {
 const html = render(createElement(DraftForm, { id: "a", version: 1, coverLetter: "", selected: "", editable: true, documents: [{ id: "pending", filename: "pending.pdf", scanStatus: "PENDING" }, { id: "blocked", filename: "blocked.pdf", scanStatus: "REJECTED" }] }));
 assert.ok(html.includes('value="pending"')); assert.ok(!html.includes('value="blocked"'));
 assert.ok(html.includes('It must pass screening before you pay and submit.')); assert.ok(html.includes('maxLength="6000"'));
 assert.ok(html.includes('Save your changes before requesting payment.'));
});
test("locked application shows read-only saved details without a draft form or save control", () => {
 const html = render(createElement(DraftForm, { id: "a", version: 2, coverLetter: "Saved letter", selected: "cv", editable: false, documents: [{ id: "cv", filename: "attached.pdf", scanStatus: "CLEAN" }] }));
 assert.ok(html.includes('Saved letter')); assert.ok(html.includes('attached.pdf')); assert.ok(html.includes('Read only'));
 assert.ok(!html.includes('<form')); assert.ok(!html.includes('Save draft'));
 assert.ok(applicationGuidance("DRAFT", false).includes('locked'));
 assert.ok(applicationGuidance("WITHDRAWN", false).includes('does not automatically refund'));
});
test("responses escape message HTML, display Nairobi dates and preserve response pagination", () => {
 const html = render(createElement(ApplicationResponses, { result: { responses: [{ id: "r", source: "EMPLOYER", senderLabel: "Coffee team", body: "<img onerror=alert(1)>", status: "SHORTLISTED", createdAt: new Date("2026-10-29T10:00:00Z") }], pagination: { page: 2, total: 50, pageCount: 3 } } }));
 assert.ok(html.includes('&lt;img onerror=alert(1)&gt;')); assert.ok(!html.includes('<img onerror'));
 assert.ok(html.includes('dateTime="2026-10-29T10:00:00.000Z"')); assert.ok(html.includes('Nairobi time'));
 assert.ok(html.includes('?responsePage=1')); assert.ok(html.includes('?responsePage=3'));
});
test("withdrawal stays an explicit confirmed action with optional reason and manual refund expectations", () => {
 const html = render(createElement(WithdrawApplication, { id: "a", version: 2 }));
 assert.ok(html.includes('<details')); assert.match(html, /type="checkbox"[^>]*required/);
 assert.ok(html.includes('does not automatically refund')); assert.ok(html.includes('maxLength="2000"'));
 assert.ok(html.includes('Confirm withdrawal')); assert.ok(!/<textarea[^>]*required/.test(html));
});
