import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildTimeline, type TimelineInput } from "../src/lib/application-timeline";
import { ApplicationTimeline } from "../src/components/application-timeline";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 23, 8, minutes));
const base: TimelineInput = { status: "DRAFT", createdAt: at(0), history: [], responses: [] };
const titles = (input: TimelineInput) => buildTimeline(input).map(node => `${node.state}:${node.title}`);

test("a draft is the current step, with submit, review, shortlist and the final decision ahead", () => {
  assert.deepEqual(titles(base), ["current:Application started", "upcoming:Submit your application", "upcoming:Recruiter review", "upcoming:Shortlist", "upcoming:Final decision · application closed"]);
});

test("a just-submitted application shows the submission as now, without the automatic payment note", () => {
  const nodes = buildTimeline({ ...base, status: "SUBMITTED", history: [{ toStatus: "SUBMITTED", message: "Application fee paid from wallet", createdAt: at(5) }] });
  assert.deepEqual(nodes.map(node => `${node.state}:${node.title}`), ["done:Application started", "current:Application submitted", "upcoming:Recruiter review", "upcoming:Shortlist", "upcoming:Final decision · application closed"]);
  assert.equal(nodes[1].message, undefined);
});

test("a status change and its message become one node; a plain message gets its own node", () => {
  const nodes = buildTimeline({ ...base, status: "SHORTLISTED",
    history: [{ toStatus: "SUBMITTED", message: "Application fee confirmed by M-Pesa", createdAt: at(5) }, { toStatus: "SHORTLISTED", message: "Come for a tasting on Friday.", createdAt: at(30) }],
    responses: [{ id: "r1", source: "EMPLOYER", senderLabel: "Java House", body: "Thanks, we're reading it now.", status: "SUBMITTED", createdAt: at(20) },
      { id: "r2", source: "EMPLOYER", senderLabel: "Java House", body: "Come for a tasting on Friday.", status: "SHORTLISTED", createdAt: at(30) }] });
  assert.deepEqual(nodes.map(node => `${node.state}:${node.title}`), ["done:Application started", "done:Application submitted", "done:Message from Java House", "current:Shortlisted", "upcoming:Final decision · application closed"]);
  const shortlisted = nodes.find(node => node.title === "Shortlisted")!;
  assert.equal(shortlisted.by, "Java House"); assert.equal(shortlisted.message, "Come for a tasting on Friday.");
  assert.equal(nodes.filter(node => node.message === "Come for a tasting on Friday.").length, 1, "Not shown twice");
});

test("a decided application ends with Application closed in the outcome's colour", () => {
  const hired = buildTimeline({ ...base, status: "HIRED", history: [{ toStatus: "SUBMITTED", message: null, createdAt: at(5) }, { toStatus: "HIRED", message: "Welcome aboard!", createdAt: at(50) }] });
  assert.deepEqual(hired.slice(-2).map(node => `${node.state}:${node.title}:${node.tone}`), ["done:Hired:hired", "closed:Application closed:hired"]);
  assert.ok(!hired.some(node => node.state === "upcoming" || node.state === "current"));
  const withdrawn = buildTimeline({ ...base, status: "WITHDRAWN", history: [{ toStatus: "SUBMITTED", message: null, createdAt: at(5) }, { toStatus: "WITHDRAWN", message: "The applicant withdrew this application.", createdAt: at(9) }],
    responses: [{ id: "w", source: "APPLICANT", senderLabel: "Applicant", body: "The applicant withdrew this application.", status: "WITHDRAWN", createdAt: at(9) }] });
  const node = withdrawn.find(item => item.title === "Withdrawn")!;
  assert.equal(node.by, "You"); assert.equal(node.message, undefined, "The default withdrawal note isn't repeated");
  assert.equal(withdrawn.at(-1)!.tone, "withdrawn");
});

test("the timeline renders a chain with the current step marked and messages escaped", () => {
  const html = renderToStaticMarkup(createElement(ApplicationTimeline, { data: { ...base, status: "SUBMITTED", history: [{ toStatus: "SUBMITTED", message: null, createdAt: at(5) }],
    responses: [{ id: "m", source: "EMPLOYER", senderLabel: "Bean <Bar>", body: "<b>Hello</b>", status: "SUBMITTED", createdAt: at(7) }] } }));
  assert.ok(html.includes("Application timeline")); assert.ok(html.includes('aria-current="step"')); assert.equal((html.match(/>Now</g) || []).length, 1);
  assert.equal((html.match(/>Up next</g) || []).length, 1, "Only the next step says Up next");
  assert.ok(html.includes("Message from Bean &lt;Bar&gt;")); assert.ok(html.includes("&lt;b&gt;Hello&lt;/b&gt;")); assert.ok(!html.includes("<b>Hello"));
  assert.ok(html.includes("Final decision · application closed"));
});
