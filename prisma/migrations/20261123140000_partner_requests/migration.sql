-- Partner requests from the public "Partner with us" form, and the address admin alerts go to.

-- CreateEnum
CREATE TYPE "PartnerRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "adminNotificationEmail" TEXT;

-- CreateTable
CREATE TABLE "PartnerRequest" (
    "id" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PartnerRequestStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT NOT NULL,
    "notifiedAt" TIMESTAMPTZ(3),
    "handledById" TEXT,
    "handledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerRequest_status_createdAt_idx" ON "PartnerRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerRequest_ipHash_createdAt_idx" ON "PartnerRequest"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "PartnerRequest" ADD CONSTRAINT "PartnerRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
