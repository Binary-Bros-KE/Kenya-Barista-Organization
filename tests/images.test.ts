import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { checkImage, cloudinaryConfig, cloudinaryStore, removeAvatar, setAvatar, signParams, sniffImage, type ImageStore } from "../src/server/images";
import { avatarSrc, coverSrc, imagePublicId } from "../src/lib/images";
import { profileInput, saveProfile } from "../src/server/applications";
import { getManagedJob, removeJobCover, setJobCover } from "../src/server/jobs";
import { getPublicJob } from "../src/server/public-jobs";
import { ProfileCard } from "../src/components/profile-card";
import { profileChecklist, type StudioProfile } from "../src/components/profile-studio";
import { JobCover } from "../src/components/job-cover";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const env = (values: Record<string, string>) => ({ CLOUDINARY_FOLDER: "kbo", ...values }) as never;

test("only real JPG, PNG and WebP files under the size limit are accepted", () => {
  assert.equal(sniffImage(png), "png"); assert.equal(sniffImage(jpeg), "jpeg"); assert.equal(sniffImage(webp), "webp");
  assert.equal(sniffImage(Buffer.from("%PDF-1.7")), null); assert.equal(sniffImage(Buffer.from("<svg onload=alert(1)>")), null, "SVG is refused");
  assert.doesNotThrow(() => checkImage(png, "avatars"));
  assert.throws(() => checkImage(Buffer.alloc(0), "avatars"), { code: "EMPTY_FILE" });
  assert.throws(() => checkImage(Buffer.from("GIF89a"), "avatars"), { code: "IMAGE_REQUIRED" });
  assert.throws(() => checkImage(Buffer.concat([jpeg, Buffer.alloc(5 * 1024 * 1024)]), "avatars"), { code: "INVALID_SIZE" });
  assert.doesNotThrow(() => checkImage(Buffer.concat([jpeg, Buffer.alloc(5 * 1024 * 1024)]), "job-covers"), "Covers allow up to 8 MB");
});

test("Cloudinary settings come from CLOUDINARY_URL or the three separate values", () => {
  assert.deepEqual(cloudinaryConfig(env({ CLOUDINARY_URL: "cloudinary://123:s3cret@democloud" })), { cloudName: "democloud", apiKey: "123", apiSecret: "s3cret", folder: "kbo" });
  assert.deepEqual(cloudinaryConfig(env({ CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s", CLOUDINARY_FOLDER: "kbo-dev" })), { cloudName: "c", apiKey: "k", apiSecret: "s", folder: "kbo-dev" });
  assert.equal(cloudinaryConfig(env({ CLOUDINARY_CLOUD_NAME: "c" })), null, "Missing keys leave uploads switched off");
});

test("upload requests are signed the way Cloudinary documents", async () => {
  // Example from Cloudinary's "Generating authentication signatures" guide.
  assert.equal(signParams({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" }, "abcd"), "bfd09f95f331f558cbd1320e67aa8d488770583e");
  const sent: { url: string; body: FormData }[] = [];
  const store = cloudinaryStore({ cloudName: "democloud", apiKey: "123", apiSecret: "s3cret", folder: "kbo" }, (async (url: string, init: RequestInit) => { sent.push({ url, body: init.body as FormData }); return Response.json({ version: 1700000001 }); }) as typeof fetch);
  assert.deepEqual(await store.upload("kbo/avatars/u1", png, "avatars"), { version: 1700000001 });
  const body = sent[0].body;
  assert.equal(sent[0].url, "https://api.cloudinary.com/v1_1/democloud/image/upload");
  assert.equal(body.get("public_id"), "kbo/avatars/u1"); assert.equal(body.get("overwrite"), "true"); assert.equal(body.get("api_key"), "123");
  assert.ok(!JSON.stringify([...body.keys()]).includes("api_secret"), "The secret is never sent");
  const signed = Object.fromEntries(["invalidate", "overwrite", "public_id", "timestamp", "transformation"].map(key => [key, String(body.get(key))]));
  assert.equal(body.get("signature"), signParams(signed, "s3cret"));
  const failing = cloudinaryStore({ cloudName: "c", apiKey: "k", apiSecret: "s", folder: "kbo" }, (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch);
  await assert.rejects(failing.upload("kbo/avatars/u1", png, "avatars"), { code: "IMAGE_SERVICE_FAILED" });
});

test("image URLs are resized, versioned and empty without a photo", () => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "democloud"; process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER = "kbo";
  assert.equal(avatarSrc("user1", 42, 40), "https://res.cloudinary.com/democloud/image/upload/c_fill,g_face,w_80,h_80,f_auto,q_auto/v42/kbo/avatars/user1");
  assert.equal(coverSrc("job1", 7, 720, 300), "https://res.cloudinary.com/democloud/image/upload/c_fill,g_auto,w_720,h_300,f_auto,q_auto/v7/kbo/job-covers/job1");
  assert.equal(avatarSrc("user1", null), null);
  assert.throws(() => imagePublicId("avatars", "../etc"), "Ids can't escape the folder");
  const branded = renderToStaticMarkup(createElement(JobCover, { id: "job1", coverVersion: null, category: "ROASTING" }));
  assert.ok(branded.includes("job-cover") && !branded.includes("<img"), "No photo gives the branded cover");
  assert.ok(renderToStaticMarkup(createElement(JobCover, { id: "job1", coverVersion: 7, category: "ROASTING" })).includes("v7/kbo/job-covers/job1"));
});

test("profile links are cleaned up and skills are de-duplicated", () => {
  const base = { fullName: "Achieng Odhiambo", phone: "+254712345678", location: "Nairobi", summary: "" };
  const parsed = profileInput.parse({ ...base, instagram: "https://www.instagram.com/achieng.brews/?hl=en", linkedin: "linkedin.com/in/achieng", website: "achieng.coffee", skills: ["Latte art", "latte art", "Cupping"], headline: "  ", experienceYears: 6 });
  assert.equal(parsed.instagram, "achieng.brews"); assert.equal(parsed.linkedin, "https://linkedin.com/in/achieng"); assert.equal(parsed.website, "https://achieng.coffee");
  assert.deepEqual(parsed.skills, ["Latte art", "Cupping"]); assert.equal(parsed.headline, null);
  assert.equal(profileInput.parse({ ...base, instagram: "@achieng" }).instagram, "achieng");
  assert.ok(!profileInput.safeParse({ ...base, linkedin: "facebook.com/achieng" }).success);
  assert.ok(!profileInput.safeParse({ ...base, skills: Array.from({ length: 13 }, (_, i) => `Skill ${i}`) }).success);
  assert.ok(!profileInput.safeParse({ ...base, accent: "neon" }).success);
  assert.ok(profileInput.safeParse(base).success, "The original four fields still work on their own");
});

test("the profile card and checklist show what recruiters see", () => {
  const card = { name: "Achieng Odhiambo", headline: null, location: "Nairobi", experienceYears: 6, skills: ["Latte art"], openToWork: true, accent: "teal", photo: null, instagram: "achieng", linkedin: null, website: "https://achieng.coffee" };
  const recruiterView = renderToStaticMarkup(createElement(ProfileCard, { data: card }));
  assert.ok(recruiterView.includes("Open to work")); assert.ok(recruiterView.includes("6 years in coffee")); assert.ok(recruiterView.includes("https://instagram.com/achieng"));
  assert.ok(recruiterView.includes(">AO<"), "Initials without a photo"); assert.ok(!recruiterView.includes("Add a headline"), "Recruiters don't see editing hints");
  assert.ok(renderToStaticMarkup(createElement(ProfileCard, { data: card, preview: true })).includes("Add a headline"));
  const profile: StudioProfile = { fullName: "Achieng", phone: "+254712345678", location: "Nairobi", summary: "", headline: "", experienceYears: null, skills: [], openToWork: true, instagram: "", linkedin: "", website: "", accent: "espresso" };
  assert.deepEqual(profileChecklist(profile, false, 0).filter(item => item.done).map(item => item.label), ["Add your contact details"]);
  assert.ok(profileChecklist({ ...profile, headline: "Head barista", summary: "x".repeat(80), skills: ["a1", "b1", "c1"], experienceYears: 3 }, true, 1).every(item => item.done));
});

test("photos and job covers are saved, replaced and removed", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.JOB_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.JOB_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)); assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID().slice(0, 8), users: string[] = [];
  const calls: string[] = [];
  let next = 100;
  const store: ImageStore = { folder: "kbo-test", async upload(publicId) { calls.push(`upload ${publicId}`); return { version: ++next }; }, async remove(publicId) { calls.push(`remove ${publicId}`); } };
  const actor = async (name: string, role: "ADMIN" | "RECRUITER" | "APPLICANT" = "APPLICANT"): Promise<Actor> => {
    const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, role } }); users.push(user.id);
    return { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
  };
  try {
    const seeker = await actor("img-seeker"), recruiter = await actor("img-recruiter", "RECRUITER"), other = await actor("img-other", "RECRUITER");
    await assert.rejects(setAvatar(db, seeker, Buffer.from("not an image"), store), { code: "IMAGE_REQUIRED" });
    assert.equal(calls.length, 0, "Bad files never reach Cloudinary");
    assert.deepEqual(await setAvatar(db, seeker, png, store), { avatarVersion: 101 });
    assert.equal(calls.at(-1), `upload kbo-test/avatars/${seeker.user.id}`);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: seeker.user.id } })).avatarVersion, 101);
    await removeAvatar(db, seeker, store);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: seeker.user.id } })).avatarVersion, null);
    await assert.rejects(removeAvatar(db, seeker, store), { status: 404 });

    const saved = await saveProfile(db, seeker, { fullName: "Image Seeker", phone: "+254712345678", location: "Nairobi", summary: "", headline: "Head barista", skills: ["Latte art"], experienceYears: 4, accent: "teal" });
    assert.equal(saved.headline, "Head barista"); assert.deepEqual(saved.skills, ["Latte art"]);
    await assert.rejects(saveProfile(db, seeker, { fullName: "Image Seeker", phone: "+254712345678", location: "Nairobi", summary: "", linkedin: "not linkedin" }), { code: "INVALID_PROFILE", message: "Enter your LinkedIn profile link" });

    const job = await db.job.create({ data: { recruiterId: recruiter.user.id, title: "Head Barista", slug: `img-job-${suffix}`, description: "Fixture", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", applicationFeeMinor: 10000, status: "PUBLISHED", publishedAt: new Date(), deadline: new Date(Date.now() + 864000000) } });
    await assert.rejects(setJobCover(db, other, job.id, job.version, png, store), { status: 404 }, "Recruiters can't change other recruiters' jobs");
    await assert.rejects(setJobCover(db, recruiter, job.id, job.version + 5, png, store), { code: "STALE_JOB" });
    const covered = await setJobCover(db, recruiter, job.id, job.version, png, store);
    assert.equal(covered.coverVersion, next); assert.equal(covered.status, "DRAFT", "A new cover on a live posting goes back for review");
    assert.equal(calls.at(-1), `upload kbo-test/job-covers/${job.id}`);
    assert.ok((await getManagedJob(db, recruiter, job.id)).history.some(entry => entry.note === "Published posting returned to draft after a cover change"));
    const removed = await removeJobCover(db, recruiter, job.id, covered.version, store);
    assert.equal(removed.coverVersion, null); assert.equal(calls.at(-1), `remove kbo-test/job-covers/${job.id}`);

    await db.job.update({ where: { id: job.id }, data: { status: "PUBLISHED", coverVersion: 555 } });
    await db.user.update({ where: { id: recruiter.user.id }, data: { avatarVersion: 9 } });
    const publicJob = await getPublicJob(db, job.slug);
    assert.equal(publicJob.coverVersion, 555); assert.equal(publicJob.employer.avatarVersion, 9, "The recruiter's photo is the employer logo");
  } finally {
    await db.jobStatusHistory.deleteMany({ where: { job: { recruiterId: { in: users } } } });
    await db.outboxEvent.deleteMany({ where: { kind: "job.updated", aggregateId: { in: (await db.job.findMany({ where: { recruiterId: { in: users } }, select: { id: true } })).map(job => job.id) } } });
    await db.job.deleteMany({ where: { recruiterId: { in: users } } });
    await db.applicantProfile.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
