import { z } from "zod";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";

// Account types: job seekers (APPLICANT), recruiters (RECRUITER) and administrators (ADMIN).
// Administrators switch accounts between job seeker and recruiter; administrator accounts are never changed here.
export const accountTypeInput = z.object({
  email: z.email().trim().toLowerCase().optional(), userId: z.string().min(1).max(100).optional(),
  role: z.enum(["APPLICANT", "RECRUITER"]),
}).strict().refine(value => !!value.email !== !!value.userId, "Give either an email address or an account");

export async function setAccountType(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = accountTypeInput.parse(input);
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: data.userId ? { id: data.userId } : { email: data.email! }, select: { id: true, email: true, name: true, role: true } });
    if (!user) throw new AccessError(404, "ACCOUNT_NOT_FOUND", "No account uses that email yet. Ask them to register on KBO first.");
    if (user.role === "ADMIN") throw new AccessError(409, "ADMIN_ACCOUNT", "Administrator accounts can't be changed here");
    if (user.role !== data.role) {
      // Leaving the recruiter type also removes verification; it must be earned again.
      await tx.user.update({ where: { id: user.id }, data: { role: data.role, ...(data.role === "APPLICANT" ? { recruiterVerifiedAt: null, recruiterVerifiedById: null, recruiterVerification: Prisma.DbNull } : {}) } });
      await tx.auditLog.create({ data: { actorId: actor.user.id, action: data.role === "RECRUITER" ? "account.made_recruiter" : "account.made_job_seeker", entityType: "User", entityId: user.id } });
    }
    return { id: user.id, email: user.email, name: user.name, role: data.role };
  });
}

export async function setUserSuspended(db: PrismaClient, actor: Actor, userId: string, suspended: boolean) {
  assertAdmin(actor);
  return db.$transaction(async tx => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) throw new AccessError(404, "NOT_FOUND", "Account not found");
    if (target.id === actor.user.id || target.role === "ADMIN") throw new AccessError(403, "PROTECTED_ACCOUNT", "Administrator accounts cannot be suspended here");
    await tx.user.update({ where: { id: userId }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
    if (suspended) await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: suspended ? "account.suspended" : "account.reactivated", entityType: "User", entityId: userId } });
    return { status: suspended ? "SUSPENDED" : "ACTIVE" };
  });
}
