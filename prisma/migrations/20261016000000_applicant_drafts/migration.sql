-- AlterTable
ALTER TABLE "ApplicantProfile" ADD COLUMN     "fullName" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "applicationFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coverLetter" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'KES',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sha256" TEXT;

-- CreateIndex
CREATE INDEX "Application_userId_updatedAt_idx" ON "Application"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt");

-- Preserve the fee on any applications created before this phase.
UPDATE "Application" a SET "applicationFeeMinor" = j."applicationFeeMinor", "currency" = j."currency"
FROM "Job" j
WHERE a."jobId" = j."id";
UPDATE "Application" a SET "applicationFeeMinor" = p."amountMinor", "currency" = p."currency" FROM "PaymentOrder" p WHERE p."applicationId" = a."id";
ALTER TABLE "Application" ADD CONSTRAINT "Application_version_positive" CHECK ("version" > 0), ADD CONSTRAINT "Application_fee_nonnegative" CHECK ("applicationFeeMinor" >= 0);
