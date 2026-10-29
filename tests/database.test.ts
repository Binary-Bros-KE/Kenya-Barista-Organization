import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

test("database prevents duplicate applications and negative fees", { skip: process.env.RUN_DB_TESTS !== "true" }, async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname), "Use a local test database");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const suffix = randomUUID();
  const rollback = new Error("intentional test rollback");
  try {
    await assert.rejects(db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: `test-${suffix}@example.invalid` } });
      const organisation = await tx.organisation.create({ data: { name: "Constraint test", slug: suffix } });
      const job = await tx.job.create({ data: {
        organisationId: organisation.id, slug: suffix, title: "Constraint test", description: "Test only",
        location: "Nairobi", category: "Coffee", employmentType: "FULL_TIME",
        applicationFeeMinor: 10000, deadline: new Date(Date.now() + 86400000),
      } });
      await tx.application.create({ data: { userId: user.id, jobId: job.id } });
      await tx.$executeRaw`SAVEPOINT duplicate_application`;
      await assert.rejects(tx.application.create({ data: { userId: user.id, jobId: job.id } }), { code: "P2002" });
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT duplicate_application`;
      await tx.$executeRaw`SAVEPOINT negative_fee`;
      await assert.rejects(tx.job.update({ where: { id: job.id }, data: { applicationFeeMinor: -1 } }));
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT negative_fee`;
      throw rollback;
    }), error => error === rollback);
  } finally {
    await db.$disconnect();
  }
});
