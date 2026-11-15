import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAuth } from "../src/server/auth";
import { resolveActor, assertAdmin } from "../src/server/access";
import { bootstrapAdmin } from "../src/server/bootstrap";
import { setAccountType, setUserSuspended } from "../src/server/employers";
import type { MailMessage } from "../src/server/mail";

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.toUpperCase().replace(/=+$/, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("accounts, MFA, recruiter access, tenant isolation, and account recovery", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.AUTH_TEST_DATABASE_URL, timeout: 180000 }, async t => {
  const connectionString = process.env.AUTH_TEST_DATABASE_URL!;
  const databaseUrl = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname), "Use a local isolated test database");
  assert.notEqual(databaseUrl.port, "51214", "Never run account bootstrap tests on the development database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID();
  const messages: MailMessage[] = [];
  const deliver = async (message: MailMessage) => { messages.push(message); };
  const baseURL = "http://localhost:3000";
  const auth = createAuth(db, { secret: randomBytes(48).toString("base64url"), baseURL, deliver });
  const userIds: string[] = [];
  let bootstrapped = false;
  let sequence = 0;
  const subnet = randomBytes(1)[0];
  function client() {
    const cookies = new Map<string, string>();
    const ip = `198.18.${subnet}.${++sequence}`;
    const headers = () => new Headers({ origin: baseURL, "x-forwarded-for": ip, "user-agent": "KBO integration tests", cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") });
    return {
      headers,
      async send(path: string, body?: unknown, origin = baseURL) {
        const requestHeaders = headers(); requestHeaders.set("origin", origin);
        if (body !== undefined) requestHeaders.set("content-type", "application/json");
        const response = await auth.handler(new Request(new URL(`/api/auth${path}`, baseURL), { method: body === undefined ? "GET" : "POST", headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) }));
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(";", 1)[0]; const index = pair.indexOf("=");
          if (/max-age=0/i.test(cookie) || !pair.slice(index + 1)) cookies.delete(pair.slice(0, index));
          else cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        const bodyText = await response.text();
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(bodyText); } catch { /* Redirects have no JSON body. */ }
        return { status: response.status, data, location: response.headers.get("location") };
      },
    };
  }
  type Client = ReturnType<typeof client>;
  const password = `Test-only-passphrase-${suffix}`;
  async function register(account: Client, name: string, extra = {}) {
    const email = `${name}-${suffix}@example.invalid`;
    const response = await account.send("/sign-up/email", { email, name, password, callbackURL: `${baseURL}/sign-in`, ...extra });
    assert.equal(response.status, 200, `registration failed (${String(response.data.code)})`);
    const user = await db.user.findUniqueOrThrow({ where: { email } }); userIds.push(user.id);
    return user;
  }
  async function verify(account: Client, email: string) {
    const message = messages.findLast(message => message.to === email && message.subject.includes("Verify"));
    assert.ok(message);
    const link = new URL(message.text.match(/https?:\/\/\S+/)![0]);
    const result = await account.send(link.pathname.replace("/api/auth", "") + link.search);
    assert.equal(result.status, 302);
  }
  async function signIn(account: Client, email: string, suppliedPassword = password) {
    return account.send("/sign-in/email", { email, password: suppliedPassword, rememberMe: false });
  }
  const adminClient = client(); const employerClient = client(); const otherClient = client();
  try {
    assert.equal(await db.user.count({ where: { role: "ADMIN" } }), 0, "Test database already has an administrator; refusing to modify it");
    assert.equal(await db.platformBootstrap.count(), 0, "Use a clean isolated test database");
    const adminUser = await register(adminClient, "administrator", { role: "ADMIN", emailVerified: true, status: "ACTIVE", twoFactorEnabled: true });
    await t.test("registration cannot grant privileges and unverified login is denied", async () => {
      assert.equal(adminUser.role, "APPLICANT"); assert.equal(adminUser.emailVerified, false); assert.equal(adminUser.twoFactorEnabled, false);
      const account = await db.account.findFirstOrThrow({ where: { userId: adminUser.id } });
      assert.notEqual(account.password, password);
      assert.equal((await signIn(adminClient, adminUser.email)).status, 403);
      await verify(adminClient, adminUser.email);
      assert.equal((await signIn(adminClient, adminUser.email)).status, 200);
    });
    await t.test("bootstrap is one-time and administrator access needs only the role", async () => {
      await bootstrapAdmin(db, adminUser.email); bootstrapped = true;
      await assert.rejects(bootstrapAdmin(db, adminUser.email), { code: "BOOTSTRAP_COMPLETE" });
      await assert.rejects(resolveActor(db, auth, adminClient.headers()), { status: 401 });
      assert.equal((await signIn(adminClient, adminUser.email)).status, 200);
      assertAdmin(await resolveActor(db, auth, adminClient.headers()));
    });
    const oldSessionClient = client();
    assert.equal((await signIn(oldSessionClient, adminUser.email)).status, 200);
    const enable = await adminClient.send("/two-factor/enable", { password, method: "totp" });
    assert.equal(enable.status, 200, `MFA enable failed (${String(enable.data.code)})`);
    const secret = new URL(String(enable.data.totpURI)).searchParams.get("secret")!;
    const recoveryCodes = enable.data.backupCodes as string[];
    await t.test("authenticator enrollment grants administrator access to the verified session", async () => {
      const verifyResult = await adminClient.send("/two-factor/verify-totp", { code: totp(secret) });
      assert.equal(verifyResult.status, 200, `MFA verify failed (${String(verifyResult.data.code)})`);
      assertAdmin(await resolveActor(db, auth, adminClient.headers()));
    });
    // Two-factor is optional for administrators, so sessions created before enrollment keep access.
    assertAdmin(await resolveActor(db, auth, oldSessionClient.headers()));
    await t.test("password-only MFA challenge is unauthenticated and backup codes are single-use", async () => {
      const challenger = client();
      assert.equal((await signIn(challenger, adminUser.email)).data.twoFactorRedirect, true);
      await assert.rejects(resolveActor(db, auth, challenger.headers()), { status: 401 });
      assert.equal((await challenger.send("/two-factor/verify-totp", { code: "invalid" })).status, 401);
      assert.equal((await challenger.send("/two-factor/verify-totp", { code: totp(secret) })).status, 200);
      assertAdmin(await resolveActor(db, auth, challenger.headers()));
      const recovery = client(); await signIn(recovery, adminUser.email);
      assert.equal((await recovery.send("/two-factor/verify-backup-code", { code: recoveryCodes[0] })).status, 200);
      assertAdmin(await resolveActor(db, auth, recovery.headers()));
      const replay = client(); await signIn(replay, adminUser.email);
      assert.equal((await replay.send("/two-factor/verify-backup-code", { code: recoveryCodes[0] })).status, 401);
    });
    const employer = await register(employerClient, "employer"); await verify(employerClient, employer.email); await signIn(employerClient, employer.email);
    const other = await register(otherClient, "other"); await verify(otherClient, other.email); await signIn(otherClient, other.email);
    const admin = await resolveActor(db, auth, adminClient.headers());
    const employerActor = await resolveActor(db, auth, employerClient.headers());
    const otherActor = await resolveActor(db, auth, otherClient.headers());
    await t.test("administrators switch accounts between job seeker and recruiter", async () => {
      await assert.rejects(setAccountType(db, employerActor, { email: employer.email, role: "RECRUITER" }), { status: 403 });
      await assert.rejects(setAccountType(db, admin, { email: "missing-" + suffix + "@example.invalid", role: "RECRUITER" }), { code: "ACCOUNT_NOT_FOUND" });
      await assert.rejects(setAccountType(db, admin, { userId: admin.user.id, role: "APPLICANT" }), { code: "ADMIN_ACCOUNT" });
      await assert.rejects(setAccountType(db, admin, { email: employer.email, role: "ADMIN" }), "Administrators cannot be created here");
      assert.equal((await setAccountType(db, admin, { email: employer.email.toUpperCase(), role: "RECRUITER" })).role, "RECRUITER");
      assert.equal((await resolveActor(db, auth, employerClient.headers())).user.role, "RECRUITER", "The change applies to the existing session");
      assert.equal((await resolveActor(db, auth, otherClient.headers())).user.role, "APPLICANT");
      assert.equal((await setAccountType(db, admin, { userId: employer.id, role: "APPLICANT" })).role, "APPLICANT");
      assert.equal((await resolveActor(db, auth, employerClient.headers())).user.role, "APPLICANT");
    });
    await t.test("suspension signs an account out and blocks sign-in until reactivated", async () => {
      await setUserSuspended(db, admin, employer.id, true);
      await assert.rejects(resolveActor(db, auth, employerClient.headers()), { status: 401 });
      assert.equal((await signIn(employerClient, employer.email)).status, 403);
      await setUserSuspended(db, admin, employer.id, false);
      assert.equal((await signIn(employerClient, employer.email)).status, 200);
    });
    await t.test("password reset revokes sessions and reset tokens cannot be reused", async () => {
      assert.equal((await employerClient.send("/request-password-reset", { email: employer.email, redirectTo: `${baseURL}/reset-password` })).status, 200);
      const message = messages.findLast(message => message.to === employer.email && message.subject.includes("Reset"))!;
      const url = new URL(message.text.match(/https?:\/\/\S+/)![0]);
      const redirect = await employerClient.send(url.pathname.replace("/api/auth", "") + url.search);
      assert.equal(redirect.status, 302);
      const token = new URL(redirect.location!, baseURL).searchParams.get("token"); assert.ok(token);
      const newPassword = `Changed-${password}`;
      assert.equal((await employerClient.send("/reset-password", { token, newPassword })).status, 200);
      assert.equal(await db.session.count({ where: { userId: employer.id } }), 0);
      assert.equal((await employerClient.send("/reset-password", { token, newPassword })).status, 400);
      assert.equal((await signIn(employerClient, employer.email)).status, 401);
      assert.equal((await signIn(employerClient, employer.email, newPassword)).status, 200);
      assert.equal((await employerClient.send("/sign-out", {})).status, 200);
      await assert.rejects(resolveActor(db, auth, employerClient.headers()), { status: 401 });
    });
    await t.test("origin protection, expired sessions, and login throttling", async () => {
      assert.equal((await otherClient.send("/sign-in/email", { email: other.email, password }, "https://untrusted.example")).status, 403);
      const actor = await resolveActor(db, auth, otherClient.headers());
      await db.session.update({ where: { id: actor.session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await assert.rejects(resolveActor(db, auth, otherClient.headers()), { status: 401 });
      const blocked = client(); let status = 0;
      for (let attempt = 0; attempt < 9; attempt++) status = (await signIn(blocked, other.email, "incorrect-passphrase")).status;
      assert.equal(status, 429);
    });
  } finally {
    if (userIds.length) {
      await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await db.verification.deleteMany({ where: { value: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (bootstrapped) await db.platformBootstrap.deleteMany({ where: { id: "initial-admin" } });
    await db.$disconnect();
  }
});
