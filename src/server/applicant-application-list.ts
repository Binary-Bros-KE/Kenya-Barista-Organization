import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { applicationListQuery } from "../lib/application-view";
export async function applicantApplicationList(db: PrismaClient, actor: Actor, query: { page?: string; status?: string }) {
  const { page, status } = applicationListQuery(query);
  const owner = { userId: actor.user.id }; const where = { ...owner, ...(status ? { status } : {}) };
  const [items, total, groups] = await Promise.all([
    db.application.findMany({ where, select: { id: true, status: true, applicationFeeMinor: true, updatedAt: true, _count: { select: { responses: true } }, job: { select: { title: true, organisation: { select: { name: true } } } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }),
    db.application.count({ where }), db.application.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
  ]);
  return { items, total, counts: Object.fromEntries(groups.map(group => [group.status, group._count._all])), page, status };
}
