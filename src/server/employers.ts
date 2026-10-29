import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { assertAdmin, type Actor } from "./access";
import { AccessError } from "./errors";
import type { MailSender } from "./mail";

export const organisationInput = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens") }).strict();
export const invitationInput = z.object({ organisationId: z.string().min(1).max(100), email: z.email().trim().toLowerCase(), role: z.enum(["OWNER", "RECRUITER"]).default("RECRUITER") }).strict();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createOrganisation(db: PrismaClient, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = organisationInput.parse(input);
  return db.$transaction(async tx => {
    const existing = await tx.organisation.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (existing) throw new AccessError(409, "SLUG_UNAVAILABLE", "That organisation address is already in use");
    const organisation = await tx.organisation.create({ data });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "organisation.created", entityType: "Organisation", entityId: organisation.id } });
    return organisation;
  });
}

export async function inviteEmployer(db: PrismaClient, actor: Actor, input: unknown, settings: { baseURL: string; deliver: MailSender }) {
  assertAdmin(actor);
  const data = invitationInput.parse(input);
  const token = randomBytes(32).toString("base64url");
  const invitation = await db.$transaction(async tx => {
    const organisation = await tx.organisation.findUnique({ where: { id: data.organisationId } });
    if (!organisation || organisation.suspendedAt) throw new AccessError(404, "NOT_FOUND", "Active organisation not found");
    // Reissuing an invitation revokes earlier links for this email and organisation.
    await tx.employerInvitation.updateMany({ where: { organisationId: data.organisationId, email: data.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const created = await tx.employerInvitation.create({ data: { ...data, tokenHash: hashToken(token), createdById: actor.user.id, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "employer.invited", entityType: "EmployerInvitation", entityId: created.id } });
    return { id: created.id, organisationName: organisation.name };
  });
  const url = new URL("/invitations/accept", settings.baseURL);
  url.hash = new URLSearchParams({ token }).toString();
  try {
    await settings.deliver({ to: data.email, subject: `Employer invitation: ${invitation.organisationName}`, text: `You have been invited to ${invitation.organisationName} on Kenya Barista Organization.\n\nSign in or register with this email address, verify your email, then open:\n${url}\n\nThis invitation expires in 48 hours.` });
  } catch {
    // No undelivered live link is left behind. The admin can issue another invitation.
    await db.employerInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    throw new AccessError(502, "EMAIL_DELIVERY_FAILED", "Invitation delivery failed. Check email settings and issue a new invitation.");
  }
  return { id: invitation.id };
}

export async function acceptInvitation(db: PrismaClient, actor: Actor, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccessError(400, "INVITATION_UNAVAILABLE", "Invitation is invalid, expired, or already used");
  return db.$transaction(async tx => {
    const invitation = await tx.employerInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { organisation: true } });
    const now = new Date();
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now || invitation.organisation.suspendedAt) throw new AccessError(400, "INVITATION_UNAVAILABLE", "Invitation is invalid, expired, or already used");
    if (invitation.email !== actor.user.email.toLowerCase() || !actor.user.emailVerified || actor.user.status !== "ACTIVE") throw new AccessError(403, "INVITATION_EMAIL_MISMATCH", "Sign in with the verified email address that received this invitation");
    const claim = await tx.employerInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now } });
    if (claim.count !== 1) throw new AccessError(409, "INVITATION_UNAVAILABLE", "Invitation has already been used");
    const membership = await tx.organisationMember.upsert({ where: { userId_organisationId: { userId: actor.user.id, organisationId: invitation.organisationId } }, create: { userId: actor.user.id, organisationId: invitation.organisationId, role: invitation.role }, update: {} });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "employer.invitation_accepted", entityType: "OrganisationMember", entityId: membership.id } });
    return { organisationId: membership.organisationId };
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

export async function setOrganisationSuspended(db: PrismaClient, actor: Actor, id: string, suspended: boolean) {
  assertAdmin(actor);
  return db.$transaction(async tx => {
    const found = await tx.organisation.findUnique({ where: { id } });
    if (!found) throw new AccessError(404, "NOT_FOUND", "Organisation not found");
    const organisation = await tx.organisation.update({ where: { id }, data: { suspendedAt: suspended ? new Date() : null } });
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: suspended ? "organisation.suspended" : "organisation.reactivated", entityType: "Organisation", entityId: id } });
    return { id: organisation.id, suspendedAt: organisation.suspendedAt };
  });
}

export async function revokeInvitation(db: PrismaClient, actor: Actor, id: string) {
  assertAdmin(actor);
  return db.$transaction(async tx => {
    const result = await tx.employerInvitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) throw new AccessError(404, "NOT_FOUND", "Pending invitation not found");
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "employer.invitation_revoked", entityType: "EmployerInvitation", entityId: id } });
    return { revoked: true };
  });
}

export async function revokeMembership(db: PrismaClient, actor: Actor, id: string) {
  assertAdmin(actor);
  return db.$transaction(async tx => {
    const result = await tx.organisationMember.deleteMany({ where: { id } });
    if (!result.count) throw new AccessError(404, "NOT_FOUND", "Membership not found");
    await tx.auditLog.create({ data: { actorId: actor.user.id, action: "employer.membership_revoked", entityType: "OrganisationMember", entityId: id } });
    return { revoked: true };
  });
}
