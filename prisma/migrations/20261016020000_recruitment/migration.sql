-- CreateTable
CREATE TABLE "ApplicationResponse" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "senderLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationResponse_applicationId_createdAt_idx" ON "ApplicationResponse"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationResponse" ADD CONSTRAINT "ApplicationResponse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationResponse" ADD CONSTRAINT "ApplicationResponse_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApplicationResponse" ADD CONSTRAINT "ApplicationResponse_source_valid" CHECK ("source" IN ('ADMIN', 'EMPLOYER', 'APPLICANT')),
ADD CONSTRAINT "ApplicationResponse_body_length" CHECK (length(trim("body")) BETWEEN 1 AND 4000);
