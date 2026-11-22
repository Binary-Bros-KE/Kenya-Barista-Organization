import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { createJob, updateJob, transitionJob, getManagedJob, listManagedJobs, setDefaultFee, setJobFee, closeExpiredJobs } from "../src/server/jobs";
import { getPublicJob, listPublicJobs } from "../src/server/public-jobs";

test("job approval, public visibility, fees, concurrency, and recruiter isolation", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.JOB_TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const connectionString = process.env.JOB_TEST_DATABASE_URL!;
  const url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use an isolated local database");
  assert.notEqual(url.port, "51214", "Never run job fixtures against the development database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID(); const userIds: string[] = [];
  let settingsTouched = false; let previousFee: number | null = null; let previousSettings = false;
  const input = { title: `Lead Barista ${suffix}`, description: "Prepare excellent coffee, support the team, and provide a welcoming experience for customers. Prior barista experience is required.", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", deadline: new Date(Date.now() + 7 * 86400000).toISOString() };
  try {
    assert.equal(await db.job.count(), 0, "Refusing to run fixtures in a database with existing jobs");
    assert.equal(await db.user.count({ where: { role: "ADMIN" } }), 0, "Use a dedicated test database");
    const settings = await db.platformSettings.findUnique({ where: { id: "platform" } }); previousSettings = Boolean(settings); previousFee = settings?.defaultApplicationFeeMinor ?? null;
    await db.platformSettings.deleteMany({ where: { id: "platform" } }); settingsTouched = true;
    async function actor(name: string, role: "ADMIN" | "RECRUITER" | "APPLICANT" = "APPLICANT"): Promise<Actor> {
      const user = await db.user.create({ data: { email: `${name}-${suffix}@example.invalid`, name, emailVerified: true, role } }); userIds.push(user.id);
      return { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
    }
    const admin = await actor("job-admin", "ADMIN"); const employer = await actor("job-employer", "RECRUITER"); const outsider = await actor("job-outsider", "RECRUITER"); const applicant = await actor("job-applicant");
    await t.test("only administrators set the default fee; recruiters choose their own job's fee", async () => {
      await assert.rejects(createJob(db, employer, undefined, input), { code: "FEE_NOT_CONFIGURED" });
      await assert.rejects(setDefaultFee(db, employer, { applicationFeeKes: 100 }), { status: 403 });
      await setDefaultFee(db, admin, { applicationFeeKes: 100 });
      const ownFee = await createJob(db, outsider, undefined, { ...input, title: "Own fee posting", applicationFeeKes: 350 });
      assert.equal(ownFee.applicationFeeMinor, 35000, "A recruiter's own fee is used instead of the default");
      await assert.rejects(createJob(db, outsider, undefined, { ...input, applicationFeeKes: 0 }), "Fees are at least KES 1");
      await db.jobStatusHistory.deleteMany({ where: { jobId: ownFee.id } }); await db.auditLog.deleteMany({ where: { entityId: ownFee.id } }); await db.job.delete({ where: { id: ownFee.id } });
      await assert.rejects(createJob(db, applicant, undefined, input), { status: 403 }, "Job seekers cannot post jobs");
      await assert.rejects(createJob(db, admin, undefined, input), { status: 404 }, "Administrators must choose a recruiter");
      await assert.rejects(createJob(db, admin, applicant.user.id, input), { status: 404 }, "Jobs can only belong to recruiters");
      await assert.rejects(createJob(db, employer, undefined, { ...input, status: "PUBLISHED" }));
    });
    let job = await createJob(db, employer, undefined, input);
    const otherJob = await createJob(db, outsider, undefined, { ...input, title: "Other coffee team posting" });
    let adminJob = await createJob(db, admin, employer.user.id, { ...input, title: "Administrator posting", applicationFeeKes: 200 });
    assert.equal(adminJob.recruiterId, employer.user.id);
    await t.test("drafts are private and management queries are scoped to the recruiter", async () => {
      assert.equal(job.applicationFeeMinor, 10000); assert.equal(adminJob.applicationFeeMinor, 20000);
      assert.equal((await listPublicJobs(db, {})).pagination.total, 0);
      await assert.rejects(getPublicJob(db, job.slug), { status: 404 });
      await assert.rejects(getManagedJob(db, outsider, job.id), { status: 404 });
      await assert.rejects(updateJob(db, outsider, job.id, { ...input, version: job.version }), { status: 404 });
      assert.equal((await listManagedJobs(db, outsider, {})).pagination.total, 1);
      assert.equal((await listManagedJobs(db, employer, { recruiterId: outsider.user.id })).pagination.total, 0);
      assert.equal((await listManagedJobs(db, applicant, {})).pagination.total, 0);
    });
    await t.test("review requires explicit submission and feedback; employers cannot publish", async () => {
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      assert.equal(job.status, "PENDING_REVIEW");
      // Administrators can adjust the fee while the job waits for approval; it stays in review.
      await assert.rejects(setJobFee(db, employer, job.id, { version: job.version, applicationFeeKes: 120 }), { status: 403 });
      await assert.rejects(setJobFee(db, admin, job.id, { version: job.version - 1, applicationFeeKes: 120 }), { code: "STALE_JOB" });
      job = await setJobFee(db, admin, job.id, { version: job.version, applicationFeeKes: 120 });
      assert.equal(job.applicationFeeMinor, 12000); assert.equal(job.status, "PENDING_REVIEW", "Adjusting the fee doesn't send the job back to draft");
      assert.ok((await getManagedJob(db, employer, job.id)).history.some(entry => entry.note?.startsWith("Application fee changed from")), "The recruiter sees the change in the history");
      await assert.rejects(transitionJob(db, employer, job.id, { version: job.version, action: "publish" }), { status: 403 });
      await assert.rejects(transitionJob(db, admin, job.id, { version: job.version, action: "request_changes" }), { code: "REVIEW_NOTE_REQUIRED" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "request_changes", note: "Private review: clarify working hours" });
      assert.equal(job.status, "CHANGES_REQUESTED");
      job = await updateJob(db, employer, job.id, { ...input, version: job.version });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "publish" });
      await assert.rejects(setJobFee(db, admin, job.id, { version: job.version, applicationFeeKes: 90 }), { code: "INVALID_JOB_STATE" }, "Only before approval");
      const published = await getPublicJob(db, job.slug);
      assert.equal(published.isOpen, true);
      assert.equal("reviewNote" in published, false); assert.equal("reviewedById" in published, false); assert.equal("createdById" in published, false);
      assert.equal((await listPublicJobs(db, { q: "lead", location: "NAIROBI", category: "BARISTA", employmentType: "FULL_TIME", employer: employer.user.id })).pagination.total, 1);
      assert.equal(published.employer.name, "job-employer");
    });
    await t.test("concurrent edits cannot overwrite each other and published edits require fresh approval", async () => {
      const originalSlug = job.slug; const version = job.version;
      const results = await Promise.allSettled([updateJob(db, employer, job.id, { ...input, version, title: "Edited barista opportunity A" }), updateJob(db, employer, job.id, { ...input, version, title: "Edited barista opportunity B" })]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
      assert.equal(rejected.reason.code, "STALE_JOB");
      job = await db.job.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(job.status, "DRAFT"); assert.equal(job.slug, originalSlug); assert.equal(job.version, version + 1);
      await assert.rejects(getPublicJob(db, job.slug), { status: 404 });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "publish" });
      assert.ok(await db.outboxEvent.findFirst({ where: { aggregateId: job.id, kind: "job.updated" } }));
    });
    await t.test("default fee changes affect only new postings and applications lock a job's fee", async () => {
      await db.application.create({ data: { userId: applicant.user.id, jobId: job.id } });
      await assert.rejects(updateJob(db, admin, job.id, { ...input, version: job.version, applicationFeeKes: 250 }), { code: "FEE_LOCKED" });
      await setDefaultFee(db, admin, { applicationFeeKes: 150 });
      assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).applicationFeeMinor, 12000);
      const created = await createJob(db, employer, undefined, { ...input, title: "New fee posting" }); assert.equal(created.applicationFeeMinor, 15000);
    });
    await t.test("deadlines hide expired jobs immediately and scheduled closing is replay-safe", async () => {
      job = await db.job.update({ where: { id: job.id }, data: { deadline: new Date(Date.now() - 1000) } });
      assert.equal((await listPublicJobs(db, {})).pagination.total, 0);
      assert.equal((await getPublicJob(db, job.slug)).isOpen, false);
      assert.equal((await closeExpiredJobs(db)).closed, 1); assert.equal((await closeExpiredJobs(db)).closed, 0);
      job = await db.job.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(job.status, "CLOSED"); assert.equal((await getPublicJob(db, job.slug)).isOpen, false);
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "reopen" });
      await assert.rejects(transitionJob(db, employer, job.id, { version: job.version, action: "submit" }), { code: "DEADLINE_PASSED" });
      job = await updateJob(db, employer, job.id, { ...input, version: job.version });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "publish" });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "close" });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "archive" });
      await assert.rejects(getPublicJob(db, job.slug), { status: 404 });
    });
    await t.test("jobs awaiting review can be edited and stay in review; archived jobs cannot be edited or submitted", async () => {
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "submit" });
      const reviewedVersion = adminJob.version;
      adminJob = await updateJob(db, employer, adminJob.id, { ...input, title: "Edited while in review", version: adminJob.version });
      assert.equal(adminJob.status, "PENDING_REVIEW", "Saving keeps the job in review"); assert.equal(adminJob.title, "Edited while in review");
      assert.ok((await getManagedJob(db, employer, adminJob.id)).history.some(entry => entry.note === "Edited while awaiting review"));
      await assert.rejects(transitionJob(db, admin, adminJob.id, { version: reviewedVersion, action: "publish" }), { code: "STALE_JOB" }, "An administrator cannot approve the version from before the edit");
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "withdraw" });
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "archive" });
      await assert.rejects(transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "submit" }), { code: "INVALID_JOB_STATE" });
      await assert.rejects(updateJob(db, admin, adminJob.id, { ...input, version: adminJob.version }), { code: "INVALID_JOB_STATE" }, "Archived jobs cannot be edited");
      await assert.rejects(createJob(db, admin, employer.user.id, { ...input, deadline: new Date(Date.now() - 1000).toISOString() }), { code: "DEADLINE_PASSED" });
    });
    await t.test("public search is filtered and paginated without exposing private fields", async () => {
      await db.job.createMany({ data: Array.from({ length: 13 }, (_, i) => ({ recruiterId: employer.user.id, title: `Paged-${suffix} ${i}`, slug: `paged-${suffix}-${i}`, description: input.description, location: "Mombasa", category: "ROASTING", employmentType: "CONTRACT", deadline: new Date(input.deadline), applicationFeeMinor: 10000, status: "PUBLISHED" as const, publishedAt: new Date(), reviewNote: "Private draft notes" })) });
      const query = { q: `Paged-${suffix}`, location: "mombasa", category: "ROASTING", employmentType: "CONTRACT", employer: employer.user.id };
      const firstPage = await listPublicJobs(db, query); const secondPage = await listPublicJobs(db, { ...query, page: 2 });
      assert.equal(firstPage.jobs.length, 12); assert.equal(secondPage.jobs.length, 1); assert.equal(firstPage.pagination.total, 13);
      assert.equal(new Set([...firstPage.jobs, ...secondPage.jobs].map(item => item.slug)).size, 13);
      assert.ok(firstPage.jobs.every(item => !("reviewNote" in item) && !("version" in item)));
      await assert.rejects(listPublicJobs(db, { page: 0 }));
      await db.user.update({ where: { id: employer.user.id }, data: { status: "SUSPENDED" } });
      assert.equal((await listPublicJobs(db, query)).pagination.total, 0);
      await assert.rejects(getPublicJob(db, firstPage.jobs[0].slug), { status: 404 });
      await db.user.update({ where: { id: employer.user.id }, data: { status: "ACTIVE" } });
      await db.user.update({ where: { id: employer.user.id }, data: { role: "APPLICANT" } });
      const demoted = { ...employer, user: { ...employer.user, role: "APPLICANT" as const } };
      await assert.rejects(getManagedJob(db, demoted, job.id), { status: 404 }, "Job seekers lose access to their old jobs");
      assert.equal((await listManagedJobs(db, demoted, {})).pagination.total, 0);
      assert.equal((await listManagedJobs(db, outsider, {})).jobs[0].id, otherJob.id);
    });
  } finally {
    if (userIds.length) {
      const jobs = await db.job.findMany({ where: { recruiterId: { in: userIds } }, select: { id: true } }); const ids = jobs.map(job => job.id);
      await db.application.deleteMany({ where: { jobId: { in: ids } } });
      await db.jobStatusHistory.deleteMany({ where: { jobId: { in: ids } } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await db.auditLog.deleteMany({ where: { entityType: "Job", entityId: { in: ids } } });
      await db.job.deleteMany({ where: { id: { in: ids } } });
    }
    if (userIds.length) { await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await db.user.deleteMany({ where: { id: { in: userIds } } }); }
    if (settingsTouched) { if (previousSettings) await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform", defaultApplicationFeeMinor: previousFee }, update: { defaultApplicationFeeMinor: previousFee } }); else await db.platformSettings.deleteMany({ where: { id: "platform" } }); }
    await db.$disconnect();
  }
});
