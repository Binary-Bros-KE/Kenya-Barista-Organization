-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationEmails" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'APPLICANT',
ADD COLUMN     "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "body" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "href" TEXT NOT NULL DEFAULT '/dashboard',
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "sentAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "failedAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "recipientCursor" TEXT;

-- CreateIndex
CREATE INDEX "Notification_deliveryStatus_availableAt_idx" ON "Notification"("deliveryStatus", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventId_userId_key" ON "Notification"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OutboxEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_delivery_status_valid" CHECK ("deliveryStatus" IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
ADD CONSTRAINT "Notification_audience_valid" CHECK ("audience" IN ('APPLICANT', 'EMPLOYER', 'ADMIN')),
ADD CONSTRAINT "Notification_attempts_nonnegative" CHECK ("attempts" >= 0);
