-- Track each account's most recent sign-in for the administrator accounts page.
ALTER TABLE "User" ADD COLUMN "lastSignInAt" TIMESTAMPTZ(3);

-- Backfill from sessions that still exist.
UPDATE "User" u SET "lastSignInAt" = s.latest
FROM (SELECT "userId", MAX("createdAt") AS latest FROM "Session" GROUP BY "userId") s
WHERE s."userId" = u."id";

CREATE INDEX "User_lastSignInAt_idx" ON "User"("lastSignInAt");
