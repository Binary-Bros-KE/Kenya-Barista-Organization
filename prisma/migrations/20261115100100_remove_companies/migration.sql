-- Companies are removed: jobs belong directly to a recruiter account.

-- 1. Give every job a recruiter: its creator if they were on the company team, otherwise the company's
--    first owner, then first member, then the creator, and finally the first administrator.
ALTER TABLE "Job" ADD COLUMN "recruiterId" TEXT;
UPDATE "Job" j SET "recruiterId" = COALESCE(
  (SELECT m."userId" FROM "OrganisationMember" m WHERE m."organisationId" = j."organisationId" AND m."userId" = j."createdById"),
  (SELECT m."userId" FROM "OrganisationMember" m WHERE m."organisationId" = j."organisationId" ORDER BY (m."role" = 'OWNER') DESC, m."createdAt" ASC LIMIT 1),
  j."createdById",
  (SELECT u."id" FROM "User" u WHERE u."role" = 'ADMIN' ORDER BY u."createdAt" ASC LIMIT 1)
);

-- 2. Anyone who was on a company team, or now owns a job, becomes a recruiter (administrators stay administrators).
UPDATE "User" SET "role" = 'RECRUITER'
WHERE "role" = 'APPLICANT'
  AND ("id" IN (SELECT "userId" FROM "OrganisationMember") OR "id" IN (SELECT "recruiterId" FROM "Job"));

-- 3. Live jobs of suspended companies are closed rather than becoming visible again.
UPDATE "Job" SET "status" = 'CLOSED', "closedAt" = COALESCE("closedAt", NOW())
WHERE "status" = 'PUBLISHED' AND "organisationId" IN (SELECT "id" FROM "Organisation" WHERE "suspendedAt" IS NOT NULL);

ALTER TABLE "Job" ALTER COLUMN "recruiterId" SET NOT NULL;

-- 4. Remove companies, memberships and invitations.
ALTER TABLE "EmployerInvitation" DROP CONSTRAINT "EmployerInvitation_organisationId_fkey";
ALTER TABLE "EmployerInvitation" DROP CONSTRAINT "EmployerInvitation_createdById_fkey";
ALTER TABLE "OrganisationMember" DROP CONSTRAINT "OrganisationMember_userId_fkey";
ALTER TABLE "OrganisationMember" DROP CONSTRAINT "OrganisationMember_organisationId_fkey";
ALTER TABLE "Job" DROP CONSTRAINT "Job_organisationId_fkey";
DROP INDEX "Job_organisationId_status_idx";
ALTER TABLE "Job" DROP COLUMN "organisationId";
DROP TABLE "Organisation";
DROP TABLE "EmployerInvitation";
DROP TABLE "OrganisationMember";
DROP TYPE "MembershipRole";

CREATE INDEX "Job_recruiterId_status_idx" ON "Job"("recruiterId", "status");
ALTER TABLE "Job" ADD CONSTRAINT "Job_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
