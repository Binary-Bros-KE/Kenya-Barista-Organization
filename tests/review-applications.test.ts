import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ReviewApplications } from "../src/components/review-applications";

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (props: Parameters<typeof ReviewApplications>[0]) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(ReviewApplications, props)));
const app = (id: string, accent: string, skills: string[]) => ({ id, status: "SUBMITTED" as const, submittedAt: new Date("2026-11-23T12:09:00Z"), version: 2, applicantName: "Nyongesa Evans", location: "Nairobi South",
  job: { id: "job1", title: "Head Barista <Position>", recruiter: { name: "Binary Bros" } },
  applicant: { id: "u_" + id, avatarVersion: null, headline: "A passionate barista", accent, skills, experienceYears: 1 } });

test("applications show colour status chips with counts and horizontal cards in each applicant's colour", () => {
  const html = render({ query: { status: "SUBMITTED" }, jobs: [{ id: "job1", title: "Head Barista" }],
    result: { counts: { SUBMITTED: 2, HIRED: 1 }, applications: [app("a1", "teal", ["Latte art", "Espresso", "Cash handling", "Menu", "Service"]), app("a2", "not-a-colour", [])], pagination: { page: 1, total: 2, pageCount: 1 } } as never });
  assert.ok(/aria-current="page" class="rapp-chip is-submitted"[^>]*>New<span>2</.test(html), "The active chip is highlighted with its count");
  assert.ok(/class="rapp-chip is-all"[^>]*>All<span>3</.test(html)); assert.ok(/is-hired"[^>]*>Hired<span>1</.test(html));
  assert.equal((html.match(/class="rapp-card"/g) || []).length, 2);
  assert.ok(html.includes("--from:#14a397"), "Teal profile colour on the band"); assert.ok(html.includes("--from:#5a3a26"), "Unknown colours fall back to espresso");
  assert.ok(html.includes(">NE<"), "Initials without a photo"); assert.ok(html.includes("Head Barista &lt;Position&gt;"));
  assert.ok(html.includes("Nairobi South · 1 year in coffee · Applied")); assert.ok(html.includes(">+2<"), "Extra skills are summarised");
  assert.ok(html.includes('href="/employer/applications?open=a1"'), "Cards open the applicants popup");
  assert.ok(html.includes('<input type="hidden" name="status" value="SUBMITTED"/>'), "Searching keeps the status filter");
});

test("an empty filtered list offers to clear the filters", () => {
  const html = render({ query: { q: "nobody" }, jobs: [], result: { counts: {}, applications: [], pagination: { page: 1, total: 0, pageCount: 0 } } as never });
  assert.ok(html.includes("No applications match")); assert.ok(html.includes(">Clear filters<"));
});
