-- CreateEnum
CREATE TYPE "MpesaKind" AS ENUM ('PAYBILL', 'TILL');

-- CreateEnum
CREATE TYPE "MpesaEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "frozenSnapshot" JSONB;

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "callbackTokenHash" TEXT,
ADD COLUMN     "configurationId" TEXT,
ADD COLUMN     "evidenceCipher" TEXT,
ADD COLUMN     "payerCipher" TEXT,
ADD COLUMN     "queryAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "queryLeaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "reviewReason" TEXT;

-- CreateTable
CREATE TABLE "MpesaConfiguration" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "MpesaKind" NOT NULL,
    "environment" "MpesaEnvironment" NOT NULL,
    "businessShortCode" TEXT NOT NULL,
    "tillNumber" TEXT,
    "credentialsCipher" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MpesaConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpesaSettingsLock" (
    "id" TEXT NOT NULL DEFAULT 'platform',

    CONSTRAINT "MpesaSettingsLock_pkey" PRIMARY KEY ("id")
);

INSERT INTO "MpesaSettingsLock" ("id") VALUES ('platform');

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_callbackTokenHash_key" ON "PaymentAttempt"("callbackTokenHash");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "MpesaConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MpesaConfiguration_one_enabled_kind" ON "MpesaConfiguration"("kind") WHERE "enabled" = true;
ALTER TABLE "MpesaConfiguration" ADD CONSTRAINT "MpesaConfiguration_destination" CHECK (("kind" = 'TILL' AND "tillNumber" IS NOT NULL) OR ("kind" = 'PAYBILL' AND "tillNumber" IS NULL));
CREATE UNIQUE INDEX "PaymentAttempt_one_unresolved_order" ON "PaymentAttempt"("paymentOrderId") WHERE "status" IN ('PENDING', 'NEEDS_REVIEW');
CREATE INDEX "PaymentAttempt_reconciliation" ON "PaymentAttempt"("status", "queryAfter");
