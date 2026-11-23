-- Wallet: balances, a ledger of every change, and manual M-Pesa top-up claims reviewed by administrators.

-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('TOP_UP', 'APPLICATION_FEE');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');


-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "topUpName" TEXT,
ADD COLUMN     "topUpPhone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "walletBalanceMinor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "balanceAfterMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "topUpId" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopUpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "creditedMinor" INTEGER,
    "mpesaCode" TEXT NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopUpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_topUpId_key" ON "WalletEntry"("topUpId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_paymentOrderId_key" ON "WalletEntry"("paymentOrderId");

-- CreateIndex
CREATE INDEX "WalletEntry_userId_createdAt_idx" ON "WalletEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpRequest_mpesaCode_key" ON "TopUpRequest"("mpesaCode");

-- CreateIndex
CREATE INDEX "TopUpRequest_status_createdAt_idx" ON "TopUpRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TopUpRequest_userId_createdAt_idx" ON "TopUpRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "TopUpRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard rails the application relies on.
ALTER TABLE "User" ADD CONSTRAINT "User_wallet_not_negative" CHECK ("walletBalanceMinor" >= 0);
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_amount_not_zero" CHECK ("amountMinor" <> 0 AND "balanceAfterMinor" >= 0);
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_amount_positive" CHECK ("amountMinor" > 0 AND ("creditedMinor" IS NULL OR "creditedMinor" > 0));
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_code_format" CHECK ("mpesaCode" ~ '^[A-Z0-9]{10}$');
