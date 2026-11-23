import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { applicationListQuery } from "../lib/application-view";
import { asEmployer } from "../lib/employer";
export async function applicantApplicationList(db: PrismaClient, actor: Actor, query: { page?: string; status?: string }) {
  const { page, status } = applicationListQuery(query);
  const owner = { userId: actor.user.id }; const where = { ...owner, ...(status ? { status } : {}) };
  const [items, total, groups] = await Promise.all([
    db.application.findMany({ where, select: { id: true, status: true, applicationFeeMinor: true, updatedAt: true, _count: { select: { responses: true } }, job: { select: { title: true, recruiter: { select: { id: true, name: true, role: true, recruiterVerifiedAt: true, avatarVersion: true } } } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }),
    db.application.count({ where }), db.application.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
  ]);
  // Jobs posted by KBO administrators show as the organisation, like everywhere else on the site.
  return { items: items.map(item => ({ ...item, job: { ...item.job, recruiter: asEmployer(item.job.recruiter) } })), total, counts: Object.fromEntries(groups.map(group => [group.status, group._count._all])), page, status };
}
