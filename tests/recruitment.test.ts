import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { PrismaClient, type ApplicationStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { listReviewApplications, getReviewApplication, respondToApplication, withdrawApplication, applicantResponses, reviewResponses, downloadReviewCv, reviewJobOptions } from "../src/server/recruitment";
import { uploadCv } from "../src/server/documents";
import { listManagedJobs } from "../src/server/jobs";

test("recruitment isolation, immutable submissions, responses and withdrawal", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.RECRUITMENT_TEST_DATABASE_URL, timeout: 180000 }, async t => {
  const connectionString = process.env.RECRUITMENT_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.notEqual(url.port, "51214");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: Number(process.env.TEST_DATABASE_POOL_MAX || 1) }) });
  const userIds: string[] = [], organisationIds: string[] = [], jobIds: string[] = [], applicationIds: string[] = [];
  const suffix = randomUUID(), previousStorage = process.env.PRIVATE_UPLOAD_DIR;
  const storage = await mkdtemp(path.join(os.tmpdir(), "barista-recruitment-")); process.env.PRIVATE_UPLOAD_DIR = storage;
  async function actor(name: string, admin = false): Promise<Actor> {
    const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, role: admin ? "ADMIN" : "APPLICANT", twoFactorEnabled: admin } }); userIds.push(user.id);
    return { user, session: { id: randomUUID(), mfaVerifiedAt: admin ? new Date() : null } };
  }
  try {
    assert.equal(await db.application.count(), 0, "Use an isolated empty recruitment database");
    assert.equal(await db.user.count({ where: { role: "ADMIN" } }), 0, "Use an isolated database");
    const applicant = await actor("candidate"), employer = await actor("employer"), other = await actor("other-employer"), admin = await actor("review-admin", true);
    for (const name of ["first", "second"]) { const org = await db.organisation.create({ data: { name: `${name} coffee team`, slug: `${name}-${suffix}` } }); organisationIds.push(org.id); }
    await db.organisationMember.create({ data: { userId: employer.user.id, organisationId: organisationIds[0] } });
    await db.organisationMember.create({ data: { userId: other.user.id, organisationId: organisationIds[1] } });
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    const cv = await uploadCv(db, applicant, pdf, "submitted-cv.pdf");
    const document = await db.document.update({ where: { id: cv.id }, data: { scanStatus: "CLEAN" } });
    await db.applicantProfile.create({ data: { userId: applicant.user.id, fullName: "Changed current name", phone: "+254799999999", location: "Mombasa", summary: "New summary" } });
    async function application(options: { organisationId?: string; status?: ApplicationStatus; paid?: boolean; submitted?: boolean } = {}) {
      const organisationId = options.organisationId || organisationIds[0];
      const job = await db.job.create({ data: { organisationId, slug: randomUUID(), title: "Recruitment Barista", description: "Coffee team role", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", status: "CLOSED", applicationFeeMinor: 10000, deadline: new Date(Date.now() - 10000), publishedAt: new Date(Date.now() - 86400000) } }); jobIds.push(job.id);
      const app = await db.application.create({ data: { userId: applicant.user.id, jobId: job.id, status: options.status || "SUBMITTED", submittedAt: options.submitted === false ? null : new Date(), applicationFeeMinor: 10000,
        submissionSnapshot: { fullName: "Frozen Applicant", email: applicant.user.email, phone: "+254712345678", location: "Nairobi", summary: "Submitted summary", coverLetter: "Original application", documentId: cv.id, documentSha256: document.sha256!, jobTitle: "Original job title", organisationName: "Original coffee team", jobVersion: 1, applicationVersion: 1 },
        documents: { create: { documentId: cv.id } }, paymentOrder: { create: { amountMinor: 10000, status: options.paid === false ? "PENDING" : "SUCCEEDED", paidAt: options.paid === false ? null : new Date() } },
      } }); applicationIds.push(app.id); return app;
    }
    const primary = await application(), second = await application({ organisationId: organisationIds[1] });
    const draft = await application({ status: "DRAFT", submitted: false }), unpaid = await application({ paid: false }), unsubmitted = await application({ submitted: false });
    await t.test("employers see only confirmed submissions in their own organisation", async () => {
      const result = await listReviewApplications(db, employer, {}); assert.equal(result.pagination.total, 1); assert.equal(result.applications[0].id, primary.id); assert.equal(result.applications[0].applicantName, "Frozen Applicant");
      assert.ok(!JSON.stringify(result).includes("documentSha256")); assert.ok(!JSON.stringify(result).includes("payerCipher"));
      for (const id of [second.id, draft.id, unpaid.id, unsubmitted.id]) await assert.rejects(getReviewApplication(db, employer, id), { status: 404 });
      assert.equal((await reviewJobOptions(db, employer)).length, 1);
      const jobs = await listManagedJobs(db, employer, {}); assert.equal(jobs.jobs.find(j => j.id === draft.jobId)?._count.applications, 0);
      await assert.rejects(listReviewApplications(db, employer, { status: "DRAFT" }));
      assert.equal((await listReviewApplications(db, employer, { jobId: second.jobId })).pagination.total, 0);
    });
    await t.test("submitted profile and CV remain frozen after profile changes", async () => {
      const view = await getReviewApplication(db, employer, primary.id); assert.equal(view.profile.fullName, "Frozen Applicant"); assert.equal(view.profile.location, "Nairobi"); assert.equal(view.profile.coverLetter, "Original application");
      assert.deepEqual((await downloadReviewCv(db, employer, primary.id)).bytes, pdf);
      await assert.rejects(downloadReviewCv(db, other, primary.id), { status: 404 });
      assert.equal(await db.auditLog.count({ where: { entityId: primary.id, action: "application.cv_downloaded" } }), 1);
    });
    await t.test("CV screening and file digests are rechecked on download", async () => {
      await db.document.update({ where: { id: cv.id }, data: { scanStatus: "REJECTED" } }); await assert.rejects(downloadReviewCv(db, employer, primary.id), { status: 404 });
      await db.document.update({ where: { id: cv.id }, data: { scanStatus: "CLEAN" } });
      await writeFile(path.join(storage, document.storageKey), Buffer.from("tampered file")); await assert.rejects(downloadReviewCv(db, employer, primary.id), { code: "CV_UNAVAILABLE" });
      await writeFile(path.join(storage, document.storageKey), pdf);
      await unlink(path.join(storage, document.storageKey)); await assert.rejects(downloadReviewCv(db, employer, primary.id), { status: 404 });
      await writeFile(path.join(storage, document.storageKey), pdf);
    });
    await t.test("admin access requires MFA; revoked membership and suspension take effect", async () => {
      await assert.rejects(getReviewApplication(db, { ...admin, session: { ...admin.session, mfaVerifiedAt: null } }, primary.id), { code: "MFA_REQUIRED" });
      assert.equal((await listReviewApplications(db, admin, {})).pagination.total, 2);
      await db.organisationMember.deleteMany({ where: { userId: employer.user.id } }); await assert.rejects(getReviewApplication(db, employer, primary.id), { status: 404 });
      await db.organisationMember.create({ data: { userId: employer.user.id, organisationId: organisationIds[0] } });
      await db.organisation.update({ where: { id: organisationIds[0] }, data: { suspendedAt: new Date() } });
      await assert.rejects(getReviewApplication(db, employer, primary.id), { status: 404 }); assert.equal((await getReviewApplication(db, admin, primary.id)).id, primary.id);
      await assert.rejects(respondToApplication(db, admin, primary.id, { version: 1, status: "UNDER_REVIEW", message: "Reviewing" }), { code: "ORGANISATION_SUSPENDED" });
      await db.organisation.update({ where: { id: organisationIds[0] }, data: { suspendedAt: null } });
    });
    await t.test("status changes require feedback and reject skipped or privileged fields", async () => {
      await assert.rejects(respondToApplication(db, employer, primary.id, { version: 1, status: "HIRED", message: "Offer" }), { code: "INVALID_TRANSITION" });
      await assert.rejects(respondToApplication(db, employer, primary.id, { version: 1, status: "UNDER_REVIEW", message: "" }));
      await assert.rejects(respondToApplication(db, employer, primary.id, { version: 1, message: "Hello", authorId: admin.user.id }));
      await assert.rejects(respondToApplication(db, other, primary.id, { version: 1, message: "Hello" }), { status: 404 });
      await assert.rejects(respondToApplication(db, employer, primary.id, { version: 2, message: "Future version" }), { code: "STALE_APPLICATION" });
    });
    await t.test("concurrent recruiter actions cannot overwrite a decision or duplicate history", async () => {
      const results = await Promise.allSettled([
        respondToApplication(db, employer, primary.id, { version: 1, status: "UNDER_REVIEW", message: "We are reviewing your application." }),
        respondToApplication(db, employer, primary.id, { version: 1, status: "UNDER_REVIEW", message: "Second reviewer action" }),
      ]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(await db.applicationResponse.count({ where: { applicationId: primary.id } }), 1);
      assert.equal(await db.applicationStatusHistory.count({ where: { applicationId: primary.id } }), 1);
      assert.equal((await db.application.findUniqueOrThrow({ where: { id: primary.id } })).version, 2);
    });
    await t.test("responses are owner-visible, immutable, and queue one notification event", async () => {
      const sent = await respondToApplication(db, employer, primary.id, { version: 2, message: "Please confirm your interview availability. <script>literal</script>" }); assert.equal(sent.version, 3);
      const timeline = await applicantResponses(db, applicant, primary.id); assert.equal(timeline.responses.length, 2); assert.ok(timeline.responses.some(r => r.body.includes("<script>")));
      assert.ok(!JSON.stringify(timeline).includes("authorId"));
      await assert.rejects(applicantResponses(db, other, primary.id), { status: 404 }); await assert.rejects(reviewResponses(db, other, primary.id), { status: 404 });
      assert.equal(await db.outboxEvent.count({ where: { aggregateId: sent.response.id, kind: "application.response" } }), 1);
    });
    await t.test("shortlisting then hiring is final; follow-up messages preserve the decision", async () => {
      await respondToApplication(db, employer, primary.id, { version: 3, status: "SHORTLISTED", message: "You have been shortlisted." });
      await respondToApplication(db, employer, primary.id, { version: 4, status: "HIRED", message: "We would like you to join the team." });
      await assert.rejects(respondToApplication(db, admin, primary.id, { version: 5, status: "REJECTED", message: "Reverse hiring" }), { code: "INVALID_TRANSITION" });
      await respondToApplication(db, employer, primary.id, { version: 5, message: "We will contact you about onboarding." });
      assert.equal((await getReviewApplication(db, employer, primary.id)).status, "HIRED");
      await assert.rejects(withdrawApplication(db, applicant, primary.id, { version: 6 }), { code: "CANNOT_WITHDRAW" });
    });
    await t.test("withdrawal is owner-only, stops review and CV access, and preserves payment", async () => {
      const app = await application(); await assert.rejects(withdrawApplication(db, other, app.id, { version: 1 }), { status: 404 });
      await withdrawApplication(db, applicant, app.id, { version: 1, reason: "I accepted another offer." });
      assert.equal((await getReviewApplication(db, employer, app.id)).status, "WITHDRAWN");
      await assert.rejects(downloadReviewCv(db, employer, app.id), { status: 404 });
      await assert.rejects(respondToApplication(db, employer, app.id, { version: 2, message: "Continue reviewing" }), { code: "APPLICATION_WITHDRAWN" });
      assert.equal((await db.paymentOrder.findUniqueOrThrow({ where: { applicationId: app.id } })).status, "SUCCEEDED");
      assert.equal((await applicantResponses(db, applicant, app.id)).responses[0].source, "APPLICANT");
    });
    await t.test("recruiter versus withdrawal races have one winner and a consistent status", async () => {
      const app = await application();
      const results = await Promise.allSettled([respondToApplication(db, employer, app.id, { version: 1, status: "SHORTLISTED", message: "Shortlisted for interview" }), withdrawApplication(db, applicant, app.id, { version: 1 })]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(await db.applicationResponse.count({ where: { applicationId: app.id } }), 1);
      const current = await db.application.findUniqueOrThrow({ where: { id: app.id } }); assert.ok(["WITHDRAWN", "SHORTLISTED"].includes(current.status)); assert.equal(current.version, 2);
    });
    await t.test("lists and responses paginate without leaking other organisations", async () => {
      const app = await application(); let version = 1;
      for (let i = 0; i < 21; i++) { const result = await respondToApplication(db, employer, app.id, { version, message: `Response ${i}` }); version = result.version; }
      assert.equal((await applicantResponses(db, applicant, app.id, 1)).responses.length, 20); assert.equal((await applicantResponses(db, applicant, app.id, 2)).responses.length, 1);
      await assert.rejects(applicantResponses(db, applicant, app.id, 0));
      for (let i = 0; i < 20; i++) await application();
      const first = await listReviewApplications(db, employer, {}), next = await listReviewApplications(db, employer, { page: 2 }); assert.equal(first.applications.length, 20); assert.ok(next.applications.length > 0);
      assert.ok(![...first.applications, ...next.applications].some(a => a.id === second.id));
      assert.equal((await listReviewApplications(db, employer, { q: applicant.user.email.toUpperCase() })).pagination.total, first.pagination.total);
    });
    await t.test("inconsistent payment amounts and damaged snapshots cannot be reviewed or actioned", async () => {
      const app = await application();
      await db.paymentOrder.update({ where: { applicationId: app.id }, data: { amountMinor: 9000 } });
      await assert.rejects(getReviewApplication(db, employer, app.id), { code: "SUBMISSION_UNAVAILABLE" });
      await assert.rejects(respondToApplication(db, employer, app.id, { version: 1, message: "Should not send" }), { code: "SUBMISSION_UNAVAILABLE" });
      await db.paymentOrder.update({ where: { applicationId: app.id }, data: { amountMinor: 10000 } });
      await db.application.update({ where: { id: app.id }, data: { submissionSnapshot: { fullName: "Incomplete snapshot" } } });
      await assert.rejects(getReviewApplication(db, employer, app.id), { code: "SUBMISSION_UNAVAILABLE" });
      assert.equal(await db.applicationResponse.count({ where: { applicationId: app.id } }), 0);
    });
  } finally {
    const responseIds = (await db.applicationResponse.findMany({ where: { applicationId: { in: applicationIds } }, select: { id: true } })).map(r => r.id);
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: [...applicationIds, ...responseIds] } } });
    await db.applicationResponse.deleteMany({ where: { applicationId: { in: applicationIds } } });
    await db.applicationStatusHistory.deleteMany({ where: { applicationId: { in: applicationIds } } }); await db.paymentOrder.deleteMany({ where: { applicationId: { in: applicationIds } } });
    await db.applicationDocument.deleteMany({ where: { applicationId: { in: applicationIds } } }); await db.application.deleteMany({ where: { id: { in: applicationIds } } });
    await db.document.deleteMany({ where: { userId: { in: userIds } } }); await db.applicantProfile.deleteMany({ where: { userId: { in: userIds } } }); await db.job.deleteMany({ where: { id: { in: jobIds } } });
    await db.organisationMember.deleteMany({ where: { userId: { in: userIds } } }); await db.organisation.deleteMany({ where: { id: { in: organisationIds } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await db.user.deleteMany({ where: { id: { in: userIds } } }); await db.$disconnect();
    if (previousStorage === undefined) delete process.env.PRIVATE_UPLOAD_DIR; else process.env.PRIVATE_UPLOAD_DIR = previousStorage;
    assert.ok(path.resolve(storage).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(storage).startsWith("barista-recruitment-")); await rm(storage, { recursive: true, force: true });
  }
});
