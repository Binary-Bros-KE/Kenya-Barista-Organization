import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ManagedJobCards, JobList } from "../src/components/job-list";
import { RecruitmentActions } from "../src/components/recruitment-actions";
function render(component: ReactNode) { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never }, component)); }
const job = { id: "job", title: "<script>Barista</script>", status: "PUBLISHED" as const, deadline: "2020-01-01T10:00:00Z", applicationFeeMinor: 10000, organisation: { name: "Coffee Co" }, _count: { applications: 3 } };
test("posting cards retain management and applicant routes, accurate count labels and safe job text", () => {
 const html = render(createElement(ManagedJobCards, { jobs: [job] }));
 assert.ok(html.includes('href="/employer/jobs/job"')); assert.ok(html.includes('href="/employer/applications?jobId=job"'));
 assert.ok(html.includes('3 confirmed applications')); assert.ok(html.includes('Deadline passed. New applications are unavailable.'));
 assert.ok(html.includes('&lt;script&gt;Barista&lt;/script&gt;')); assert.ok(!html.includes('<script>Barista'));
});
test("admin cards preserve the review route without changing employer application review links", () => {
 const html = render(createElement(ManagedJobCards, { jobs: [job], admin: true }));
 assert.ok(html.includes('href="/admin/jobs/job"')); assert.ok(html.includes('Review / manage')); assert.ok(html.includes('href="/employer/applications?jobId=job"'));
});
test("posting list retains scoped create links, labeled filters and a loading state", () => {
 const html = render(createElement(JobList, { organisationId: "org / example" }));
 assert.ok(html.includes('organisationId=org%20%2F%20example')); assert.ok(html.includes('for="employer-job-status"'));
 assert.ok(html.includes('role="status"')); assert.ok(html.includes('Loading job postings...'));
});
test("recruiter response choices follow current review transitions and exclude unavailable outcomes", () => {
 const submitted = render(createElement(RecruitmentActions, { id: "app", version: 1, status: "SUBMITTED", paused: false }));
 for (const status of ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"]) assert.ok(submitted.includes('value="'+status+'"'));
 assert.ok(!submitted.includes('value="HIRED"')); assert.ok(submitted.includes('maxLength="4000"'));
 const shortlisted = render(createElement(RecruitmentActions, { id: "app", version: 2, status: "SHORTLISTED", paused: false }));
 assert.ok(shortlisted.includes('value="HIRED"')); assert.ok(!shortlisted.includes('value="UNDER_REVIEW"'));
 for (const status of ["HIRED", "REJECTED"]) {
 const html = render(createElement(RecruitmentActions, { id: "app", version: 3, status, paused: false }));
 assert.ok(html.includes('Send response')); assert.ok(!html.includes('value="SHORTLISTED"')); assert.ok(!html.includes('value="HIRED"'));
 }
});
test("withdrawn applications and suspended organisations do not expose a response form", () => {
 for (const props of [{ status: "WITHDRAWN", paused: false }, { status: "SUBMITTED", paused: true }]) {
 const html = render(createElement(RecruitmentActions, { id: "app", version: 1, ...props }));
 assert.ok(!html.includes('<form')); assert.ok(!html.includes('Send response'));
 }
});
