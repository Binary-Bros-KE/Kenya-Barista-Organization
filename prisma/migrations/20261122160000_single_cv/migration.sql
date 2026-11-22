-- One current CV per account. Uploading a new CV replaces the old one; an old CV that applications
-- still use is retired (hidden from its owner, kept for those applications) instead of deleted.
ALTER TABLE "Document" ADD COLUMN "retiredAt" TIMESTAMPTZ(3);

-- Accounts that already have several CVs keep their newest as the current one.
UPDATE "Document" AS d SET "retiredAt" = CURRENT_TIMESTAMP
WHERE d."id" NOT IN (SELECT DISTINCT ON ("userId") "id" FROM "Document" ORDER BY "userId", "createdAt" DESC, "id" DESC);

CREATE UNIQUE INDEX "Document_one_current_per_user" ON "Document" ("userId") WHERE "retiredAt" IS NULL;
