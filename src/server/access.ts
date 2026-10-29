import type { PrismaClient } from "../generated/prisma/client";
import type { AuthInstance } from "./auth";
import { AccessError } from "./errors";

export async function resolveActor(db: PrismaClient, auth: AuthInstance, headers: Headers) {
  const authenticated = await auth.api.getSession({ headers });
  if (!authenticated) throw new AccessError(401, "SIGN_IN_REQUIRED", "Please sign in to continue");
  // Re-read current database state. Never trust a role cached in a cookie or page.
  const session = await db.session.findUnique({ where: { id: authenticated.session.id }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) throw new AccessError(401, "SIGN_IN_REQUIRED", "Please sign in to continue");
  if (session.user.status !== "ACTIVE") throw new AccessError(403, "ACCOUNT_UNAVAILABLE", "Account access unavailable");
  if (!session.user.emailVerified) throw new AccessError(403, "EMAIL_VERIFICATION_REQUIRED", "Please verify your email address");
  return { user: session.user, session: { id: session.id, mfaVerifiedAt: session.mfaVerifiedAt } };
}
export type Actor = Awaited<ReturnType<typeof resolveActor>>;

export function assertAdmin(actor: Actor) {
  if (actor.user.role !== "ADMIN") throw new AccessError(403, "FORBIDDEN", "Administrator access required");
  if (!actor.user.twoFactorEnabled || !actor.session.mfaVerifiedAt) throw new AccessError(403, "MFA_REQUIRED", "Verify two-factor authentication to access administration");
}

export async function requireOrganisation(db: PrismaClient, actor: Actor, organisationId: string) {
  const membership = await db.organisationMember.findUnique({ where: { userId_organisationId: { userId: actor.user.id, organisationId } }, include: { organisation: true } });
  if (!membership || membership.organisation.suspendedAt) throw new AccessError(404, "NOT_FOUND", "Organisation not found");
  return membership;
}
