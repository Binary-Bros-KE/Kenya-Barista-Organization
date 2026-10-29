import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { createJob, updateJob, transitionJob, getManagedJob, listManagedJobs, setDefaultFee, closeExpiredJobs } from "../src/server/jobs";
import { getPublicJob, listPublicJobs } from "../src/server/public-jobs";

test("job approval, public visibility, fees, concurrency, and organisation isolation", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.JOB_TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const connectionString = process.env.JOB_TEST_DATABASE_URL!;
  const url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use an isolated local database");
  assert.notEqual(url.port, "51214", "Never run job fixtures against the development database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID(); const userIds: string[] = []; const organisationIds: string[] = [];
  let settingsTouched = false; let previousFee: number | null = null; let previousSettings = false;
  const input = { title: `Lead Barista ${suffix}`, description: "Prepare excellent coffee, support the team, and provide a welcoming experience for customers. Prior barista experience is required.", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", deadline: new Date(Date.now() + 7 * 86400000).toISOString() };
  try {
    assert.equal(await db.job.count(), 0, "Refusing to run fixtures in a database with existing jobs");
    assert.equal(await db.user.count({ where: { role: "ADMIN" } }), 0, "Use a dedicated test database");
    const settings = await db.platformSettings.findUnique({ where: { id: "platform" } }); previousSettings = Boolean(settings); previousFee = settings?.defaultApplicationFeeMinor ?? null;
    await db.platformSettings.deleteMany({ where: { id: "platform" } }); settingsTouched = true;
    async function actor(name: string, admin = false): Promise<Actor> {
      const user = await db.user.create({ data: { email: `${name}-${suffix}@example.invalid`, name, emailVerified: true, role: admin ? "ADMIN" : "APPLICANT", twoFactorEnabled: admin } }); userIds.push(user.id);
      return { user, session: { id: randomUUID(), mfaVerifiedAt: admin ? new Date() : null } };
    }
    const admin = await actor("job-admin", true); const employer = await actor("job-employer"); const outsider = await actor("job-outsider"); const applicant = await actor("job-applicant");
    const first = await db.organisation.create({ data: { name: "First coffee team", slug: `first-${suffix}` } }); organisationIds.push(first.id);
    const second = await db.organisation.create({ data: { name: "Second coffee team", slug: `second-${suffix}` } }); organisationIds.push(second.id);
    const membership = await db.organisationMember.create({ data: { userId: employer.user.id, organisationId: first.id } });
    await db.organisationMember.create({ data: { userId: outsider.user.id, organisationId: second.id } });
    await t.test("only an MFA-verified administrator configures fees and employers cannot override them", async () => {
      await assert.rejects(createJob(db, employer, first.id, input), { code: "FEE_NOT_CONFIGURED" });
      await assert.rejects(setDefaultFee(db, employer, { applicationFeeKes: 100 }), { status: 403 });
      await assert.rejects(setDefaultFee(db, { ...admin, session: { ...admin.session, mfaVerifiedAt: null } }, { applicationFeeKes: 100 }), { code: "MFA_REQUIRED" });
      await setDefaultFee(db, admin, { applicationFeeKes: 100 });
      await assert.rejects(createJob(db, employer, first.id, { ...input, applicationFeeKes: 1 }));
      await assert.rejects(createJob(db, outsider, first.id, input), { status: 404 });
      await assert.rejects(createJob(db, employer, first.id, { ...input, status: "PUBLISHED" }));
    });
    let job = await createJob(db, employer, first.id, input);
    const otherJob = await createJob(db, outsider, second.id, { ...input, title: "Other coffee team posting" });
    let adminJob = await createJob(db, admin, first.id, { ...input, title: "Administrator posting", applicationFeeKes: 200 });
    await t.test("drafts are private and management queries are scoped to membership", async () => {
      assert.equal(job.applicationFeeMinor, 10000); assert.equal(adminJob.applicationFeeMinor, 20000);
      assert.equal((await listPublicJobs(db, {})).pagination.total, 0);
      await assert.rejects(getPublicJob(db, job.slug), { status: 404 });
      await assert.rejects(getManagedJob(db, outsider, job.id), { status: 404 });
      await assert.rejects(updateJob(db, outsider, job.id, { ...input, version: job.version }), { status: 404 });
      assert.equal((await listManagedJobs(db, outsider, {})).pagination.total, 1);
      assert.equal((await listManagedJobs(db, employer, { organisationId: second.id })).pagination.total, 0);
    });
    await t.test("review requires explicit submission and feedback; employers cannot publish", async () => {
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      assert.equal(job.status, "PENDING_REVIEW");
      await assert.rejects(transitionJob(db, employer, job.id, { version: job.version, action: "publish" }), { status: 403 });
      await assert.rejects(transitionJob(db, admin, job.id, { version: job.version, action: "request_changes" }), { code: "REVIEW_NOTE_REQUIRED" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "request_changes", note: "Private review: clarify working hours" });
      assert.equal(job.status, "CHANGES_REQUESTED");
      job = await updateJob(db, employer, job.id, { ...input, version: job.version });
      job = await transitionJob(db, employer, job.id, { version: job.version, action: "submit" });
      job = await transitionJob(db, admin, job.id, { version: job.version, action: "publish" });
      const published = await getPublicJob(db, job.slug);
      assert.equal(published.isOpen, true);
      assert.equal("reviewNote" in published, false); assert.equal("reviewedById" in published, false); assert.equal("createdById" in published, false);
      assert.equal((await listPublicJobs(db, { q: "lead", location: "NAIROBI", category: "BARISTA", employmentType: "FULL_TIME", organisation: first.slug })).pagination.total, 1);
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
      assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).applicationFeeMinor, 10000);
      const created = await createJob(db, employer, first.id, { ...input, title: "New fee posting" }); assert.equal(created.applicationFeeMinor, 15000);
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
    await t.test("pending jobs must be withdrawn to edit and archived jobs cannot be submitted", async () => {
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "submit" });
      await assert.rejects(updateJob(db, admin, adminJob.id, { ...input, version: adminJob.version }), { code: "INVALID_JOB_STATE" });
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "withdraw" });
      adminJob = await transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "archive" });
      await assert.rejects(transitionJob(db, admin, adminJob.id, { version: adminJob.version, action: "submit" }), { code: "INVALID_JOB_STATE" });
      await assert.rejects(createJob(db, admin, first.id, { ...input, deadline: new Date(Date.now() - 1000).toISOString() }), { code: "DEADLINE_PASSED" });
    });
    await t.test("public search is filtered and paginated without exposing private fields", async () => {
      await db.job.createMany({ data: Array.from({ length: 13 }, (_, i) => ({ organisationId: first.id, title: `Paged-${suffix} ${i}`, slug: `paged-${suffix}-${i}`, description: input.description, location: "Mombasa", category: "ROASTING", employmentType: "CONTRACT", deadline: new Date(input.deadline), applicationFeeMinor: 10000, status: "PUBLISHED" as const, publishedAt: new Date(), reviewNote: "Private draft notes" })) });
      const query = { q: `Paged-${suffix}`, location: "mombasa", category: "ROASTING", employmentType: "CONTRACT", organisation: first.slug };
      const firstPage = await listPublicJobs(db, query); const secondPage = await listPublicJobs(db, { ...query, page: 2 });
      assert.equal(firstPage.jobs.length, 12); assert.equal(secondPage.jobs.length, 1); assert.equal(firstPage.pagination.total, 13);
      assert.equal(new Set([...firstPage.jobs, ...secondPage.jobs].map(item => item.slug)).size, 13);
      assert.ok(firstPage.jobs.every(item => !("reviewNote" in item) && !("version" in item)));
      await assert.rejects(listPublicJobs(db, { page: 0 }));
      await db.organisation.update({ where: { id: first.id }, data: { suspendedAt: new Date() } });
      assert.equal((await listPublicJobs(db, query)).pagination.total, 0);
      await assert.rejects(getPublicJob(db, firstPage.jobs[0].slug), { status: 404 });
      await assert.rejects(getManagedJob(db, employer, job.id), { status: 404 });
      await db.organisation.update({ where: { id: first.id }, data: { suspendedAt: null } });
      await db.organisationMember.delete({ where: { id: membership.id } });
      await assert.rejects(getManagedJob(db, employer, job.id), { status: 404 });
      assert.equal((await listManagedJobs(db, employer, {})).pagination.total, 0);
      assert.equal((await listManagedJobs(db, outsider, {})).jobs[0].id, otherJob.id);
    });
  } finally {
    if (organisationIds.length) {
      const jobs = await db.job.findMany({ where: { organisationId: { in: organisationIds } }, select: { id: true } }); const ids = jobs.map(job => job.id);
      await db.application.deleteMany({ where: { jobId: { in: ids } } });
      await db.jobStatusHistory.deleteMany({ where: { jobId: { in: ids } } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await db.auditLog.deleteMany({ where: { entityType: "Job", entityId: { in: ids } } });
      await db.job.deleteMany({ where: { id: { in: ids } } });
      await db.organisationMember.deleteMany({ where: { organisationId: { in: organisationIds } } });
      await db.organisation.deleteMany({ where: { id: { in: organisationIds } } });
    }
    if (userIds.length) { await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await db.user.deleteMany({ where: { id: { in: userIds } } }); }
    if (settingsTouched) { if (previousSettings) await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform", defaultApplicationFeeMinor: previousFee }, update: { defaultApplicationFeeMinor: previousFee } }); else await db.platformSettings.deleteMany({ where: { id: "platform" } }); }
    await db.$disconnect();
  }
});
