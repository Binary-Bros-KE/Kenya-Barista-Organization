import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { listRecruiterRequests, MAX_RECRUITER_REQUESTS, myRecruiterRequests, recruiterRequestInput, reviewInput, reviewRecruiterRequest, submitRecruiterRequest, unverifyRecruiter, verifyRecruiter, withdrawRecruiterRequest } from "../src/server/recruiter-requests";
import { setAccountType } from "../src/server/employers";
import { listNotifications } from "../src/server/notification-access";
import { getPublicJob } from "../src/server/public-jobs";
import { RecruiterRequest } from "../src/components/recruiter-request";
import { recruiterApprovedEmail, recruiterRejectedEmail, recruiterRequestReceivedEmail, recruiterVerifiedEmail } from "../src/server/email-templates";
import type { MailMessage } from "../src/server/mail";

const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never;
const render = (props: Parameters<typeof RecruiterRequest>[0]) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(RecruiterRequest, props)));
const valid = { hiringFor: "Java House, Westlands", roles: "Baristas and a head barista", phone: "+254712345678", location: "Nairobi" };

test("recruiter requests validate contact details and rejections need a reason", () => {
  assert.ok(recruiterRequestInput.safeParse(valid).success);
  assert.ok(recruiterRequestInput.safeParse({ ...valid, website: "instagram.com/javahouse" }).success);
  assert.ok(!recruiterRequestInput.safeParse({ ...valid, phone: "0712345678" }).success, "Phone must be +254");
  assert.ok(!recruiterRequestInput.safeParse({ ...valid, website: "not a link" }).success);
  assert.ok(!recruiterRequestInput.safeParse({ ...valid, role: "ADMIN" }).success, "Unknown fields are rejected");
  assert.ok(reviewInput.safeParse({ decision: "approve" }).success);
  assert.ok(!reviewInput.safeParse({ decision: "reject" }).success, "A rejection needs a reason");
  assert.ok(reviewInput.safeParse({ decision: "reject", note: "We couldn't reach you." }).success);
});

test("the request page shows the form, then the status, then the reason after a rejection", () => {
  const form = render({ request: null, phone: "+254700000000", location: "Nairobi" });
  assert.ok(form.includes("Ask to become a recruiter")); assert.ok(form.includes('value="+254700000000"')); assert.ok(form.includes("Send request"));
  const base = { id: "r", hiringFor: "Java House", roles: "Baristas", phone: "+254712345678", location: "Nairobi", website: null, message: "", reviewedAt: null, createdAt: new Date("2026-11-15T08:00:00Z") };
  const pending = render({ request: { ...base, status: "PENDING", reviewNote: null }, phone: "", location: "" });
  assert.ok(pending.includes("Your request is with KBO")); assert.ok(pending.includes("Withdraw request")); assert.ok(!pending.includes("Send request"));
  const rejected = render({ request: { ...base, status: "REJECTED", reviewNote: "Phone number unreachable", reviewedAt: new Date() }, earlier: [{ ...base, id: "old", hiringFor: "Old cafe", status: "REJECTED", reviewNote: "No phone answer", reviewedAt: new Date() }], used: 2, limit: 3, remaining: 1, phone: "", location: "" });
  assert.ok(rejected.includes("Phone number unreachable")); assert.ok(rejected.includes("Apply again")); assert.ok(rejected.includes("1 attempt remaining"));
  assert.ok(rejected.includes("Your requests")); assert.ok(rejected.includes("Latest")); assert.ok(rejected.includes("Old cafe")); assert.ok(rejected.includes("No phone answer"));
  const spent = render({ request: { ...base, status: "REJECTED", reviewNote: "Still unreachable", reviewedAt: new Date() }, earlier: [], used: 3, limit: 3, remaining: 0, phone: "", location: "" });
  const approved = { ...base, status: "APPROVED" as const, reviewNote: null, reviewedAt: new Date() };
  const recruiter = render({ request: approved, used: 1, isRecruiter: true, phone: "", location: "" });
  assert.ok(recruiter.includes("You&#x27;re a recruiter")); assert.ok(!recruiter.includes("remaining"));
  const demoted = render({ request: approved, used: 1, isRecruiter: false, phone: "", location: "" });
  assert.ok(!demoted.includes("You&#x27;re a recruiter"), "A demoted account is not told it is a recruiter"); assert.ok(demoted.includes("Your recruiter access was removed"));
  assert.ok(demoted.includes("Apply again")); assert.ok(demoted.includes("2 attempts remaining")); assert.ok(demoted.includes("Reverted"));
  assert.ok(spent.includes("used all 3 requests")); assert.ok(!spent.includes("Apply again")); assert.ok(!spent.includes("Send request")); assert.ok(!spent.includes("remaining"));
  assert.ok(form.includes("3 attempts remaining"));
});

test("recruiter emails are branded, link back to KBO and escape what people typed", () => {
  const base = "https://kbo.example";
  const received = recruiterRequestReceivedEmail({ baseUrl: base, name: "Achieng <b>Odhiambo</b>", hiringFor: "Java House & Co <script>", roles: "Baristas", phone: "+254712345678", location: "Nairobi" });
  assert.equal(received.subject, "We've received your recruiter request");
  assert.ok(received.html.includes("Hi Achieng,")); assert.ok(received.html.includes("Java House &amp; Co &lt;script&gt;")); assert.ok(!received.html.includes("<script>"));
  assert.ok(received.html.includes('href="https://kbo.example/dashboard/recruiter-request"')); assert.ok(received.html.includes("What happens next"));
  assert.ok(received.text.includes("Hiring for: Java House & Co <script>")); assert.ok(received.text.includes("https://kbo.example/dashboard/recruiter-request"));
  const approved = recruiterApprovedEmail({ baseUrl: base, name: "Brian", note: "Welcome <aboard>" });
  assert.ok(approved.html.includes('href="https://kbo.example/employer/jobs/new"')); assert.ok(approved.html.includes("Welcome &lt;aboard&gt;")); assert.ok(approved.text.includes("Post your first job"));
  const rejected = recruiterRejectedEmail({ baseUrl: base, name: "Brian", reason: "Phone <unreachable>" });
  assert.ok(rejected.html.includes("Phone &lt;unreachable&gt;")); assert.ok(rejected.html.includes('href="https://kbo.example/dashboard/recruiter-request"')); assert.ok(rejected.text.includes("Reason: Phone <unreachable>"));
  const verified = recruiterVerifiedEmail({ baseUrl: base, name: null });
  assert.ok(verified.html.includes("Verified recruiter")); assert.ok(verified.html.includes("Hi there,")); assert.ok(verified.html.includes("https://kbo.example/brand-logo.png"));
});

test("request, approval, verification and badge work end to end", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID().slice(0, 8), users: string[] = [];
  const actor = async (name: string, role: "ADMIN" | "RECRUITER" | "APPLICANT" = "APPLICANT"): Promise<Actor> => {
    const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, role } }); users.push(user.id);
    return { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
  };
  const sent: MailMessage[] = [];
  const mail = { baseURL: "https://kbo.example", deliver: async (message: MailMessage) => { sent.push(message); } };
  const reload = async (a: Actor): Promise<Actor> => ({ ...a, user: await db.user.findUniqueOrThrow({ where: { id: a.user.id } }) });
  try {
    const admin = await actor("req-admin", "ADMIN"), seeker = await actor("req-seeker"), other = await actor("req-other"), recruiter = await actor("req-recruiter", "RECRUITER");

    await assert.rejects(submitRecruiterRequest(db, recruiter, valid, mail), { code: "ALREADY_RECRUITER" });
    const request = await submitRecruiterRequest(db, seeker, valid, mail);
    assert.equal(sent.length, 1); assert.equal(sent[0].to, seeker.user.email); assert.equal(sent[0].subject, "We've received your recruiter request"); assert.ok(sent[0].html?.includes("Java House, Westlands"));
    const receipt = await db.notification.findFirstOrThrow({ where: { userId: seeker.user.id, kind: "recruiter_request.received" } });
    assert.equal(receipt.deliveryStatus, "SENT", "Emailed straight away, so the worker won't send it again");
    assert.equal(request.status, "PENDING");
    await assert.rejects(submitRecruiterRequest(db, seeker, valid, mail), { code: "REQUEST_PENDING" });
    assert.equal((await db.notification.findMany({ where: { userId: admin.user.id, kind: "recruiter_request.submitted" } })).length, 1, "Admins are told about new requests");

    // Withdraw and reapply; then reject with a reason.
    await withdrawRecruiterRequest(db, seeker);
    await assert.rejects(withdrawRecruiterRequest(db, seeker), { status: 404 });
    const second = await submitRecruiterRequest(db, seeker, { ...valid, website: "instagram.com/javahouse" }, mail);
    await assert.rejects(listRecruiterRequests(db, seeker, {}), { status: 403 });
    const queue = await listRecruiterRequests(db, admin, { q: suffix });
    assert.equal(queue.requests.length, 1); assert.equal(queue.requests[0].id, second.id);
    await assert.rejects(reviewRecruiterRequest(db, admin, second.id, { decision: "reject" }, mail));
    const beforeReject = sent.length;
    await reviewRecruiterRequest(db, admin, second.id, { decision: "reject", note: "We couldn't reach you on that phone number." }, mail);
    assert.equal(sent.length, beforeReject + 1); assert.equal(sent.at(-1)?.subject, "Your KBO recruiter request was rejected"); assert.ok(sent.at(-1)?.html?.includes("We couldn&#39;t reach you on that phone number."));
    assert.equal((await db.notification.findFirstOrThrow({ where: { userId: seeker.user.id, kind: "recruiter_request.rejected" } })).deliveryStatus, "SENT");
    const history = await myRecruiterRequests(db, seeker);
    assert.equal(history.request?.status, "REJECTED"); assert.deepEqual(history.earlier.map(r => r.status), ["WITHDRAWN"], "Earlier requests are kept"); assert.equal(history.remaining, 1);
    assert.equal((await reload(seeker)).user.role, "APPLICANT", "A rejected person stays a job seeker");
    const notices = await listNotifications(db, seeker, {});
    assert.ok(notices.notifications.some(n => n.title === "Your recruiter request wasn't approved"), "The decision reaches the job seeker's inbox");

    // Each account gets three requests in total; withdrawn ones count.
    for (let i = 0; i < MAX_RECRUITER_REQUESTS; i++) { await submitRecruiterRequest(db, other, valid, mail); await withdrawRecruiterRequest(db, other); }
    await assert.rejects(submitRecruiterRequest(db, other, valid, mail), { code: "REQUEST_LIMIT" });
    assert.equal((await myRecruiterRequests(db, other)).remaining, 0);

    // Apply again and get approved: the account becomes a recruiter.
    const third = await submitRecruiterRequest(db, seeker, valid, mail);
    await reviewRecruiterRequest(db, admin, third.id, { decision: "approve", note: "Welcome!" }, mail);
    assert.equal(sent.at(-1)?.subject, "You're now a recruiter on KBO"); assert.ok(sent.at(-1)?.html?.includes("Welcome!"));
    await assert.rejects(reviewRecruiterRequest(db, admin, third.id, { decision: "approve" }, mail), { code: "ALREADY_REVIEWED" });
    const promoted = await reload(seeker);
    assert.equal(promoted.user.role, "RECRUITER");
    assert.equal((await listRecruiterRequests(db, admin, { q: suffix, status: "APPROVED" })).requests.length, 1);

    // Verification needs the required checks, then shows on the recruiter's public jobs.
    const job = await db.job.create({ data: { recruiterId: seeker.user.id, title: "Head Barista", slug: `req-job-${suffix}`, description: "Fixture", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", applicationFeeMinor: 10000, status: "PUBLISHED", publishedAt: new Date(), deadline: new Date(Date.now() + 864000000) } });
    assert.equal((await getPublicJob(db, job.slug)).employer.verified, false);
    await assert.rejects(verifyRecruiter(db, admin, seeker.user.id, { checks: ["phone"] }, mail), { code: "CHECKS_INCOMPLETE" });
    await assert.rejects(verifyRecruiter(db, admin, other.user.id, { checks: ["phone", "identity"] }, mail), { status: 404 }, "Only recruiters can be verified");
    await assert.rejects(verifyRecruiter(db, seeker, seeker.user.id, { checks: ["phone", "identity"] }, mail), { status: 403 });
    await verifyRecruiter(db, admin, seeker.user.id, { checks: ["phone", "identity"], note: "Called on 15 Nov" }, mail);
    assert.equal(sent.at(-1)?.subject, "You're a verified recruiter on KBO"); assert.equal(sent.at(-1)?.to, seeker.user.email);
    assert.equal((await getPublicJob(db, job.slug)).employer.verified, true, "Verified badge shows on the job");
    const stored = await db.user.findUniqueOrThrow({ where: { id: seeker.user.id } });
    assert.deepEqual((stored.recruiterVerification as { checks: string[] }).checks, ["email", "phone", "identity"]);
    await unverifyRecruiter(db, admin, seeker.user.id);
    assert.equal((await getPublicJob(db, job.slug)).employer.verified, false);

    // Changing back to a job seeker removes verification too.
    await verifyRecruiter(db, admin, seeker.user.id, { checks: ["phone", "identity"] }, mail);
    await setAccountType(db, admin, { userId: seeker.user.id, role: "APPLICANT" });
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: seeker.user.id } })).recruiterVerifiedAt, null);
  } finally {
    await db.job.deleteMany({ where: { recruiterId: { in: users } } });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.recruiterRequest.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.updateMany({ where: { id: { in: users } }, data: { recruiterVerifiedById: null } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
