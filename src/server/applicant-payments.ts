import type { PrismaClient } from "../generated/prisma/client";
import type { Actor } from "./access";
import { historyQuery } from "../lib/payment-view";
export async function applicantPayments(db: PrismaClient, actor: Actor, query: { page?: string; status?: string }) {
 const { page, status } = historyQuery(query), owner = { application: { userId: actor.user.id } }, where = { ...owner, ...(status ? { status } : {}) };
 const [orders, total, groups] = await Promise.all([
 db.paymentOrder.findMany({ where, select: { id: true, status: true, reviewHold: true, amountMinor: true, createdAt: true, paidAt: true, refunds: { where: { status: "COMPLETED" }, select: { id: true, providerReference: true, completedAt: true } }, application: { select: { id: true, job: { select: { title: true, organisation: { select: { name: true } } } } } }, attempts: { select: { receiptNumber: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 1 } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }),
 db.paymentOrder.count({ where }), db.paymentOrder.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
 ]);
 return { orders, total, page, status, counts: Object.fromEntries(groups.map(g => [g.status, g._count._all])) };
}
