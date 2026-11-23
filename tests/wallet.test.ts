import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Actor } from "../src/server/access";
import { listTopUps, payFromWallet, reviewTopUp, saveTopUpSettings, submitTopUp, topUpInput, walletSummary } from "../src/server/wallet";
import { topUpConfirmedEmail, topUpReceivedEmail, topUpRejectedEmail } from "../src/server/email-templates";
import type { MailMessage } from "../src/server/mail";

const code = () => ("T" + randomUUID().replace(/-/g, "").toUpperCase()).slice(0, 10);

test("top-up claims need a real M-Pesa code and a sensible amount", () => {
  const paidAt = new Date().toISOString();
  assert.ok(topUpInput.safeParse({ amountKes: 500, mpesaCode: "tkl4ab12cd", paidAt }).success, "Codes are upper-cased");
  assert.equal(topUpInput.parse({ amountKes: 500, mpesaCode: " TKL4 AB12CD ", paidAt }).mpesaCode, "TKL4AB12CD");
  assert.ok(!topUpInput.safeParse({ amountKes: 500, mpesaCode: "SHORT", paidAt }).success);
  assert.ok(!topUpInput.safeParse({ amountKes: 5, mpesaCode: "TKL4AB12CD", paidAt }).success, "There is a minimum");
  assert.ok(!topUpInput.safeParse({ amountKes: 50.5, mpesaCode: "TKL4AB12CD", paidAt }).success, "Whole shillings only");
  assert.ok(!topUpInput.safeParse({ amountKes: 500, mpesaCode: "TKL4AB12CD", paidAt, userId: "x" }).success, "Unknown fields are rejected");
});

test("wallet emails tell members what happened and link to the wallet", () => {
  const facts = { baseUrl: "https://kbo.example", name: "Wanjiru Kamau", amount: "Ksh 500", code: "TKL4AB12CD", paidAt: "23 Nov 2026, 09:00" };
  const received = topUpReceivedEmail(facts), confirmed = topUpConfirmedEmail({ ...facts, balance: "Ksh 1,500" }), rejected = topUpRejectedEmail({ ...facts, reason: "Code not on statement" });
  assert.match(received.subject, /received your top-up of Ksh 500/); assert.ok(received.html.includes("TKL4AB12CD")); assert.ok(received.text.includes("/dashboard/wallet"));
  assert.match(confirmed.subject, /Ksh 500 added to your KBO wallet/); assert.ok(confirmed.html.includes("Ksh 1,500"));
  assert.match(rejected.subject, /couldn't confirm/); assert.ok(rejected.html.includes("Code not on statement"));
});

test("top-ups are claimed, confirmed once, and pay for applications from the balance", { skip: process.env.RUN_DB_TESTS !== "true" || !process.env.APPLICATION_TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const connectionString = process.env.APPLICATION_TEST_DATABASE_URL!, url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(url.pathname.includes("test"), "Use an isolated test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3 }) });
  const suffix = randomUUID().slice(0, 8), users: string[] = [], jobs: string[] = [];
  const actor = async (name: string, role: "ADMIN" | "RECRUITER" | "APPLICANT" = "APPLICANT"): Promise<Actor> => {
    const user = await db.user.create({ data: { name, email: `${name}-${suffix}@example.invalid`, emailVerified: true, role } }); users.push(user.id);
    return { user, session: { id: randomUUID(), mfaVerifiedAt: null } };
  };
  const sent: MailMessage[] = [];
  const mail = { baseURL: "https://kbo.example", deliver: async (message: MailMessage) => { sent.push(message); } };
  const previous = await db.platformSettings.findUnique({ where: { id: "platform" } });
  try {
    const member = await actor("wallet-member"), admin = await actor("wallet-admin", "ADMIN"), recruiter = await actor("wallet-recruiter", "RECRUITER");
    const paidAt = new Date(Date.now() - 3600000).toISOString();

    // Top-ups wait until an administrator sets the number.
    await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: { topUpPhone: null, topUpName: null } });
    await assert.rejects(submitTopUp(db, member, { amountKes: 500, mpesaCode: code(), paidAt }, mail), { code: "TOP_UPS_UNAVAILABLE" });
    await assert.rejects(saveTopUpSettings(db, member, { phone: "0712345678", name: "KBO" }), { status: 403 });
    assert.deepEqual(await saveTopUpSettings(db, admin, { phone: "+254712345678", name: "Kenya Barista Org" }), { phone: "0712345678", name: "Kenya Barista Org" });

    const first = await submitTopUp(db, member, { amountKes: 500, mpesaCode: code(), paidAt }, mail);
    assert.equal(first.status, "PENDING"); assert.equal((await walletSummary(db, member)).balanceMinor, 0, "Nothing is credited until confirmed");
    assert.ok(sent.some(message => message.to === member.user.email && /received your top-up/.test(message.subject)), "The member is emailed on submission");
    assert.ok(await db.notification.findFirst({ where: { userId: admin.user.id, kind: "wallet.top_up_claimed" } }), "Administrators are notified");
    await assert.rejects(submitTopUp(db, member, { amountKes: 300, mpesaCode: first.mpesaCode, paidAt }, mail), { code: "CODE_ALREADY_USED" });
    await assert.rejects(submitTopUp(db, member, { amountKes: 300, mpesaCode: code(), paidAt: new Date(Date.now() + 86400000).toISOString() }, mail), { code: "PAID_IN_FUTURE" });

    // Confirming credits the amount found on the statement, exactly once.
    await assert.rejects(reviewTopUp(db, member, first.id, { decision: "confirm", creditedKes: 500 }, mail), { status: 403 });
    await reviewTopUp(db, admin, first.id, { decision: "confirm", creditedKes: 450 }, mail);
    let wallet = await walletSummary(db, member);
    assert.equal(wallet.balanceMinor, 45000); assert.equal(wallet.entries.length, 1); assert.equal(wallet.entries[0].balanceAfterMinor, 45000); assert.equal(wallet.stats.toppedUpMinor, 45000);
    assert.ok(sent.some(message => message.to === member.user.email && /Ksh\s450 added/.test(message.subject)), "The member is emailed on confirmation");
    await assert.rejects(reviewTopUp(db, admin, first.id, { decision: "reject", note: "Changed my mind" }, mail), { code: "ALREADY_PROCESSED" });
    await assert.rejects(reviewTopUp(db, admin, first.id, { decision: "confirm", creditedKes: 450 }, mail), { code: "ALREADY_PROCESSED" }, "Processed top-ups can't be changed or credited twice");

    const second = await submitTopUp(db, member, { amountKes: 1000, mpesaCode: code(), paidAt }, mail);
    await assert.rejects(reviewTopUp(db, admin, second.id, { decision: "reject" }, mail), "A rejection needs a reason");
    await reviewTopUp(db, admin, second.id, { decision: "reject", note: "This code isn't on the statement" }, mail);
    assert.equal((await walletSummary(db, member)).balanceMinor, 45000, "Rejected top-ups add nothing");
    assert.equal((await listTopUps(db, admin, { status: "REJECTED" })).claims.find(claim => claim.id === second.id)?.reviewNote, "This code isn't on the statement");
    for (let index = 0; index < 3; index++) await submitTopUp(db, member, { amountKes: 100, mpesaCode: code(), paidAt }, mail);
    await assert.rejects(submitTopUp(db, member, { amountKes: 100, mpesaCode: code(), paidAt }, mail), { code: "TOO_MANY_PENDING" });

    // Paying an application fee from the wallet submits the application.
    const job = await db.job.create({ data: { recruiterId: recruiter.user.id, slug: `wallet-${suffix}`, title: "Wallet barista", description: "Coffee role", location: "Nairobi", category: "BARISTA", employmentType: "FULL_TIME", status: "PUBLISHED", publishedAt: new Date(), deadline: new Date(Date.now() + 86400000 * 7), applicationFeeMinor: 50000 } }); jobs.push(job.id);
    await db.applicantProfile.create({ data: { userId: member.user.id, fullName: "Wallet Member", phone: "+254712345678", location: "Nairobi", summary: "Barista" } });
    const doc = await db.document.create({ data: { userId: member.user.id, storageKey: randomUUID(), filename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 100, scanStatus: "CLEAN", sha256: "b".repeat(64) } });
    const app = await db.application.create({ data: { userId: member.user.id, jobId: job.id, applicationFeeMinor: 50000, coverLetter: "I would love to join the team.", documents: { create: { documentId: doc.id } } } });
    await assert.rejects(payFromWallet(db, member, app.id, { version: app.version }), { code: "INSUFFICIENT_BALANCE" }, "KES 450 doesn't cover a KES 500 fee");
    const third = (await listTopUps(db, admin, { status: "PENDING" })).claims.find(claim => claim.user.id === member.user.id)!;
    await reviewTopUp(db, admin, third.id, { decision: "confirm", creditedKes: 100 }, mail);
    await assert.rejects(payFromWallet(db, member, app.id, { version: app.version + 5 }), { code: "STALE_APPLICATION" });
    const paid = await payFromWallet(db, member, app.id, { version: app.version });
    assert.equal(paid.balanceMinor, 5000); assert.match(paid.receipt, /^WALLET-/);
    const submitted = await db.application.findUniqueOrThrow({ where: { id: app.id }, include: { paymentOrder: { include: { attempts: true } } } });
    assert.equal(submitted.status, "SUBMITTED"); assert.ok(submitted.submittedAt); assert.equal(submitted.paymentOrder?.status, "SUCCEEDED"); assert.equal(submitted.paymentOrder?.attempts[0].receiptNumber, paid.receipt);
    wallet = await walletSummary(db, member);
    assert.equal(wallet.entries[0].kind, "APPLICATION_FEE"); assert.equal(wallet.entries[0].amountMinor, -50000); assert.equal(wallet.stats.spentMinor, 50000);
    await assert.rejects(payFromWallet(db, member, app.id, { version: submitted.version }), { code: "ALREADY_SUBMITTED" }, "A fee is never taken twice");
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: member.user.id } })).walletBalanceMinor, 5000);
  } finally {
    const orders = await db.paymentOrder.findMany({ where: { application: { userId: { in: users } } }, select: { id: true } });
    await db.walletEntry.deleteMany({ where: { userId: { in: users } } });
    await db.topUpRequest.deleteMany({ where: { userId: { in: users } } });
    await db.paymentAttempt.deleteMany({ where: { paymentOrderId: { in: orders.map(order => order.id) } } });
    await db.paymentOrder.deleteMany({ where: { id: { in: orders.map(order => order.id) } } });
    await db.applicationStatusHistory.deleteMany({ where: { application: { userId: { in: users } } } });
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: (await db.application.findMany({ where: { userId: { in: users } }, select: { id: true } })).map(app => app.id) } } });
    await db.applicationDocument.deleteMany({ where: { application: { userId: { in: users } } } });
    await db.application.deleteMany({ where: { userId: { in: users } } });
    await db.document.deleteMany({ where: { userId: { in: users } } });
    await db.applicantProfile.deleteMany({ where: { userId: { in: users } } });
    await db.job.deleteMany({ where: { id: { in: jobs } } });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: { topUpPhone: previous?.topUpPhone ?? null, topUpName: previous?.topUpName ?? null } });
    await db.$disconnect();
  }
});
