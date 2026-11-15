-- CreateEnum
CREATE TYPE "RecruiterRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recruiterVerification" JSONB,
ADD COLUMN     "recruiterVerifiedAt" TIMESTAMPTZ(3),
ADD COLUMN     "recruiterVerifiedById" TEXT;

-- CreateTable
CREATE TABLE "RecruiterRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RecruiterRequestStatus" NOT NULL DEFAULT 'PENDING',
    "hiringFor" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "website" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecruiterRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruiterRequest_status_createdAt_idx" ON "RecruiterRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RecruiterRequest_userId_createdAt_idx" ON "RecruiterRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_recruiterVerifiedById_fkey" FOREIGN KEY ("recruiterVerifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterRequest" ADD CONSTRAINT "RecruiterRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterRequest" ADD CONSTRAINT "RecruiterRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- At most one pending request per person, even under concurrent submissions.
CREATE UNIQUE INDEX "RecruiterRequest_one_pending_per_user" ON "RecruiterRequest"("userId") WHERE "status" = 'PENDING';
