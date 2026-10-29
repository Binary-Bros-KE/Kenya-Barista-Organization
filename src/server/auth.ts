import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "../generated/prisma/client";
import { getDb } from "./database";
import { getEnv } from "../lib/env";
import { validateMailConfiguration, type MailSender } from "./mail";

export function createAuth(db: PrismaClient, settings: { secret: string; baseURL: string; deliver: MailSender }) {
  return betterAuth({
    appName: "Kenya Barista Organization",
    baseURL: settings.baseURL,
    secret: settings.secret,
    trustedOrigins: [new URL(settings.baseURL).origin],
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    emailAndPassword: {
      enabled: true, minPasswordLength: 12, maxPasswordLength: 128,
      requireEmailVerification: true, autoSignIn: false, revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: async ({ user, url }) => {
        await settings.deliver({ to: user.email, subject: "Reset your KBO password", text: `Reset your password using this link within 30 minutes:\n${url}\n\nIf you did not request this, ignore this email.` });
      },
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await settings.deliver({ to: user.email, subject: "Verify your KBO email address", text: `Verify your email using this link within one hour:\n${url}` });
      },
      afterEmailVerification: async user => {
        await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 60 * 15,
      cookieCache: { enabled: false },
      additionalFields: { mfaVerifiedAt: { type: "date", required: false, input: false, returned: false } },
    },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/two-factor/*": { window: 60, max: 8 },
      },
    },
    databaseHooks: {
      user: { create: { before: async user => {
        const name = user.name.trim();
        if (name.length < 2 || name.length > 100) throw new APIError("BAD_REQUEST", { message: "Enter a name between 2 and 100 characters" });
        return { data: { ...user, email: user.email.trim().toLowerCase(), name } };
      } } },
      session: { create: { before: async session => {
        const user = await db.user.findUnique({ where: { id: session.userId }, select: { status: true, emailVerified: true } });
        if (!user || user.status !== "ACTIVE" || !user.emailVerified) throw new APIError("FORBIDDEN", { message: "Account access unavailable" });
        return { data: { ...session, mfaVerifiedAt: null } };
      } } },
    },
    plugins: [twoFactor({ issuer: "Kenya Barista Organization", accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 } })],
    hooks: {
      before: createAuthMiddleware(async ctx => {
        // Trusted-device bypass is intentionally unavailable for administrator sessions.
        if (ctx.path.startsWith("/two-factor/") && ctx.body?.trustDevice) throw new APIError("BAD_REQUEST", { message: "Please enter a second-factor code for each sign-in" });
      }),
      after: createAuthMiddleware(async ctx => {
        if (!["/two-factor/verify-totp", "/two-factor/verify-backup-code"].includes(ctx.path)) return;
        const returned = ctx.context.returned;
        if (!returned || returned instanceof APIError) return;
        const result = returned instanceof Response ? await returned.clone().json() : returned;
        if (typeof result !== "object" || !("token" in result) || typeof result.token !== "string") return;
        const id = ctx.context.newSession?.session.id ?? ctx.context.session?.session.id;
        if (id) await db.session.updateMany({ where: { id, user: { status: "ACTIVE", twoFactorEnabled: true } }, data: { mfaVerifiedAt: new Date() } });
      }),
    },
    advanced: { cookiePrefix: "kbo", useSecureCookies: new URL(settings.baseURL).protocol === "https:", defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
    logger: { disabled: true },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth(deliver: MailSender) {
  if (instance) return instance;
  const env = getEnv();
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is missing. Run npm.cmd run auth:setup.");
  validateMailConfiguration();
  instance = createAuth(getDb(), { secret: env.AUTH_SECRET, baseURL: env.APP_URL, deliver });
  return instance;
}
export type AuthInstance = ReturnType<typeof createAuth>;
