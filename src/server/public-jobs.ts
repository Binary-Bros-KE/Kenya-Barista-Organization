import { z } from "zod";
import type { PrismaClient, Prisma } from "../generated/prisma/client";
import { AccessError } from "./errors";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || undefined);
export const publicJobQuery = z.object({
  q: optionalText(120), location: optionalText(120), organisation: optionalText(100),
  category: z.preprocess(value => value === "" ? undefined : value, z.enum(["BARISTA", "ROASTING", "HOSPITALITY", "TRAINING", "MANAGEMENT", "OTHER"]).optional()),
  employmentType: z.preprocess(value => value === "" ? undefined : value, z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"]).optional()),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export function availableJobs(now = new Date()): Prisma.JobWhereInput { return { status: "PUBLISHED", deadline: { gt: now }, organisation: { suspendedAt: null } }; }

export async function listPublicJobs(db: PrismaClient, input: unknown) {
  const query = publicJobQuery.parse(input);
  const where: Prisma.JobWhereInput = {
    ...availableJobs(),
    ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { description: { contains: query.q, mode: "insensitive" } }, { organisation: { name: { contains: query.q, mode: "insensitive" } } }] } : {}),
    ...(query.location ? { location: { contains: query.location, mode: "insensitive" } } : {}),
    ...(query.category ? { category: query.category } : {}), ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    ...(query.organisation ? { AND: [{ organisation: { slug: query.organisation } }] } : {}),
  };
  const [total, jobs] = await db.$transaction([
    db.job.count({ where }),
    db.job.findMany({ where, skip: (query.page - 1) * 12, take: 12, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], select: { slug: true, title: true, description: true, location: true, category: true, employmentType: true, deadline: true, publishedAt: true, applicationFeeMinor: true, organisation: { select: { name: true, slug: true } } } }),
  ]);
  return { jobs: jobs.map(({ description, ...job }) => ({ ...job, summary: description.slice(0, 200) })), pagination: { page: query.page, total, pageCount: Math.ceil(total / 12) } };
}

export async function publicJobFacets(db: PrismaClient) {
  return db.organisation.findMany({ where: { suspendedAt: null, jobs: { some: { status: "PUBLISHED", deadline: { gt: new Date() } } } }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 200 });
}

export async function getPublicJob(db: PrismaClient, slug: string) {
  if (slug.length > 160) throw new AccessError(404, "NOT_FOUND", "Job not found");
  const job = await db.job.findFirst({ where: { slug, status: { in: ["PUBLISHED", "CLOSED"] }, publishedAt: { not: null }, organisation: { suspendedAt: null } }, select: { slug: true, title: true, description: true, location: true, category: true, employmentType: true, deadline: true, publishedAt: true, applicationFeeMinor: true, status: true, organisation: { select: { name: true, slug: true } } } });
  if (!job) throw new AccessError(404, "NOT_FOUND", "Job not found");
  return { ...job, isOpen: job.status === "PUBLISHED" && job.deadline > new Date() };
}
