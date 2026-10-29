import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { AccessError } from "./errors";

export const profileInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, "Use +254 followed by your mobile number"),
  location: z.string().trim().min(2).max(120), summary: z.string().trim().max(3000),
}).strict();
export async function saveProfile(db: PrismaClient, actor: Actor, input: unknown) {
  const data = profileInput.parse(input);
  return db.applicantProfile.upsert({ where: { userId: actor.user.id }, create: { userId: actor.user.id, ...data }, update: data });
}
export async function ownApplication(db: PrismaClient, actor: Actor, id: string) {
  const application = await db.application.findFirst({ where: { id, userId: actor.user.id }, include: {
    job: { select: { title: true, slug: true, status: true, deadline: true, organisation: { select: { name: true, suspendedAt: true } } } },
    documents: { select: { document: { select: { id: true, filename: true, scanStatus: true } } } },
  } });
  if (!application) throw new AccessError(404, "NOT_FOUND", "Application not found");
  return application;
}
export async function startApplication(db: PrismaClient, actor: Actor, slug: string) {
  return db.$transaction(async tx => {
    const job = await tx.job.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { not: null }, deadline: { gt: new Date() }, organisation: { suspendedAt: null } } });
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
    if (application.paymentOrder && (application.paymentOrder.reviewHold || ["PENDING", "NEEDS_REVIEW", "SUCCEEDED", "REFUNDED"].includes(application.paymentOrder.status))) throw new AccessError(409, "PAYMENT_LOCKED", "This draft is locked while its payment is pending, paid, or under review");
    if (data.documentId && !await tx.document.findFirst({ where: { id: data.documentId, userId: actor.user.id, scanStatus: { in: ["PENDING", "CLEAN"] } } })) throw new AccessError(404, "DOCUMENT_UNAVAILABLE", "CV not found or unavailable");
    const changed = await tx.application.updateMany({ where: { id, userId: actor.user.id, status: "DRAFT", version: data.version }, data: { coverLetter: data.coverLetter, version: { increment: 1 } } });
    if (!changed.count) throw new AccessError(409, "STALE_APPLICATION", "This application changed. Reload before saving again");
    await tx.applicationDocument.deleteMany({ where: { applicationId: id } });
    if (data.documentId) await tx.applicationDocument.create({ data: { applicationId: id, documentId: data.documentId } });
    return { id, version: data.version + 1 };
  });
}
