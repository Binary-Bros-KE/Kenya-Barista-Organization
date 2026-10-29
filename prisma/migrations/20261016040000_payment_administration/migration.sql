-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "reviewHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "PaymentReview" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "refundId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "completedById" TEXT,
    "providerReference" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentReview_paymentOrderId_createdAt_idx" ON "PaymentReview"("paymentOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_paymentAttemptId_key" ON "RefundRecord"("paymentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_providerReference_key" ON "RefundRecord"("providerReference");

-- CreateIndex
CREATE INDEX "RefundRecord_status_createdAt_idx" ON "RefundRecord"("status", "createdAt");

ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_amount_check" CHECK ("amountMinor" > 0 AND "currency" = 'KES');
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_completion_check" CHECK (
  "status" <> 'COMPLETED' OR ("completedAt" IS NOT NULL AND "completedById" IS NOT NULL AND "providerReference" IS NOT NULL)
);

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "RefundRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
