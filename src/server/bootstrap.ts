import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { AccessError } from "./errors";

// Local CLI only: no HTTP endpoint imports this function.
export async function bootstrapAdmin(db: PrismaClient, email: string) {
  const normalised = z.email().parse(email.trim().toLowerCase());
  return db.$transaction(async tx => {
    // The unique singleton row serialises concurrent bootstrap attempts.
    if (await tx.platformBootstrap.findUnique({ where: { id: "initial-admin" } })) throw new AccessError(409, "BOOTSTRAP_COMPLETE", "Initial administrator setup has already been completed");
    await tx.platformBootstrap.create({ data: { id: "initial-admin" } });
    if (await tx.user.count({ where: { role: "ADMIN" } })) throw new AccessError(409, "BOOTSTRAP_COMPLETE", "An administrator already exists");
    const user = await tx.user.findUnique({ where: { email: normalised }, include: { accounts: { where: { providerId: "credential" } } } });
    if (!user || !user.emailVerified || user.status !== "ACTIVE" || !user.accounts.some(account => Boolean(account.password))) throw new AccessError(400, "VERIFIED_ACCOUNT_REQUIRED", "Register and verify an active email/password account first");
    await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "platform.initial_admin_created", entityType: "User", entityId: user.id } });
    return { id: user.id };
  });
}
