import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { AccessError } from "./errors";

const blankToNull = (value: unknown) => typeof value === "string" && !value.trim() ? null : value;
// Instagram is stored as a handle; LinkedIn and websites as full https links.
const instagram = z.preprocess(blankToNull, z.string().trim().max(200)
  .transform(value => value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, ""))
  .refine(value => /^[A-Za-z0-9._]{1,30}$/.test(value), "Enter your Instagram handle, e.g. @kenyabarista").nullable());
const link = (pattern: RegExp, message: string) => z.preprocess(blankToNull, z.string().trim().max(200)
  .transform(value => /^https?:\/\//i.test(value) ? value : `https://${value}`)
  .refine(value => pattern.test(value), message).nullable());
export const profileInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, "Use +254 followed by your mobile number"),
  location: z.string().trim().min(2).max(120), summary: z.string().trim().max(3000),
  headline: z.preprocess(blankToNull, z.string().trim().max(100).nullable()).optional(),
  experienceYears: z.number().int().min(0).max(50).nullable().optional(),
  skills: z.array(z.string().trim().min(2).max(30)).max(12, "Choose up to 12 skills")
    .transform(skills => skills.filter((skill, index) => skills.findIndex(other => other.toLowerCase() === skill.toLowerCase()) === index)).optional(),
  openToWork: z.boolean().optional(),
  instagram: instagram.optional(),
  linkedin: link(/^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/\S+$/i, "Enter your LinkedIn profile link").optional(),
  website: link(/^https?:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i, "Enter a website link, e.g. yourcafe.co.ke").optional(),
  accent: z.enum(["espresso", "teal", "gold", "rose", "forest"]).optional(),
}).strict();
export async function saveProfile(db: PrismaClient, actor: Actor, input: unknown) {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) throw new AccessError(400, "INVALID_PROFILE", parsed.error.issues[0]?.message || "Check your profile details and try again");
  const data = parsed.data;
  return db.applicantProfile.upsert({ where: { userId: actor.user.id }, create: { userId: actor.user.id, ...data }, update: data });
}
export async function ownApplication(db: PrismaClient, actor: Actor, id: string) {
  const application = await db.application.findFirst({ where: { id, userId: actor.user.id }, include: {
    job: { select: { title: true, slug: true, status: true, deadline: true, recruiter: { select: { name: true, status: true } } } },
    documents: { select: { document: { select: { id: true, filename: true, scanStatus: true } } } },
  } });
  if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
  return application;
}
export async function startApplication(db: PrismaClient, actor: Actor, slug: string) {
  return db.$transaction(async tx => {
    const job = await tx.job.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { not: null }, deadline: { gt: new Date() }, recruiter: { status: "ACTIVE" } } });
    if (!job) throw new AccessError(409, "JOB_UNAVAILABLE", "This job is no longer accepting applications");
    // A no-op upsert makes retries and simultaneous clicks return the same draft.
    return tx.application.upsert({ where: { userId_jobId: { userId: actor.user.id, jobId: job.id } }, update: {},
      create: { userId: actor.user.id, jobId: job.id, applicationFeeMinor: job.applicationFeeMinor, currency: job.currency } });
  });
}
export async function saveApplication(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = z.object({ version: z.number().int().positive(), coverLetter: z.string().trim().max(6000), documentId: z.string().min(1).max(100).nullable() }).strict().parse(input);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.user.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Application" WHERE "id" = ${id} FOR UPDATE`;
    const application = await tx.application.findFirst({ where: { id, userId: actor.user.id }, include: { paymentOrder: { select: { status: true, reviewHold: true } } } });
    if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
    if (application.status !== "DRAFT") throw new AccessError(409, "APPLICATION_LOCKED", "This application can no longer be edited");
    // Checked before the CV so an out-of-date editor is told to reload (its CV may have been replaced meanwhile).
    if (application.version !== data.version) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before saving again");
    if (application.paymentOrder && (application.paymentOrder.reviewHold || ["PENDING", "NEEDS_REVIEW", "SUCCEEDED", "REFUNDED"].includes(application.paymentOrder.status))) throw new AccessError(409, "PAYMENT_LOCKED", "This draft is locked while its payment is pending, paid, or under review");
    if (data.documentId && !await tx.document.findFirst({ where: { id: data.documentId, userId: actor.user.id, retiredAt: null, scanStatus: { in: ["PENDING", "CLEAN"] } } })) throw new AccessError(404, "DOCUMENT_UNAVAILABLE", "CV not found or unavailable");
    const changed = await tx.application.updateMany({ where: { id, userId: actor.user.id, status: "DRAFT", version: data.version }, data: { coverLetter: data.coverLetter, version: { increment: 1 } } });
    if (!changed.count) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before saving again");
    await tx.applicationDocument.deleteMany({ where: { applicationId: id } });
    if (data.documentId) await tx.applicationDocument.create({ data: { applicationId: id, documentId: data.documentId } });
    return { id, version: data.version + 1 };
  });
}
