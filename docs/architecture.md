# Foundation decisions

- Fresh Next.js App Router application; the parent directory is the unchanged legacy-site archive.
- TypeScript, Tailwind, PostgreSQL, Prisma 7 with the PostgreSQL driver adapter.
- Local development uses Prisma 7's included PGlite-backed Postgres server, so Docker is optional. CI and production use standard PostgreSQL.
- Use a single deployable web app, then a separate background worker using the same database.
- Deploy to the owner's VPS later. No DNS changes or production deployment in this phase.
- Visitors browse without signing in. Verified applicants apply once per job.
- Three account types: job seeker, recruiter and administrator. Administrators switch accounts between job seeker and recruiter; recruiters manage only their own jobs. Initial jobs require admin review.
- Application draft and recruitment state are independent of payment state. Server-confirmed payments submit applications atomically.
- Monetary amounts use integer minor units and a currency; payment orders snapshot fees. Daraja conversion rules are implemented during integration.
- Store all dates as timestamptz; display job deadlines in Africa/Nairobi.
- Never overwrite an attached CV: a changed document creates a new storage object and record.
- Better Auth manages email/password accounts, verification, reset tokens, database sessions, and authenticator/recovery-code flows. SMTP delivery uses Nodemailer; local mail is written to an ignored CLI-only mailbox.
- Administrator access requires current database role and an active verified account. Two-factor authentication is optional for all accounts, administrators included.
- The recruiter type is granted and removed only by administrators. Account type and suspension checks run on the server on each protected request.
- Custom job questions remain an optional later module. Manual reversal records and payment exception reviews are implemented. Notification worker leases, retries, preferences, and delivery tracking are implemented.
- M-Pesa Express supports Paybill and Till configurations, encrypted immutable credential revisions, owner-scoped checkout, callback evidence, independent server-side queries, and transactional submission. Real merchant sandbox/live acceptance remains required before launch.
- Do not expose admin or employer CRUD endpoints until server-side authentication and recruiter ownership scoping are in place.
- Initial admin bootstrap is a one-time local command promoting an existing verified account and revoking its sessions. It is never exposed as an HTTP endpoint.
- Job management is scoped to the recruiter who owns the job; administrators need the administrator role. Publication requires explicit review of a submitted posting.
- Published edits return to draft; version checks prevent stale edits/reviews. Job history, audit records, and outbox events record the transitions.
- Administrator-selected default fees are inherited by new jobs. Employers cannot set fees, and existing applications lock a job's fee.
- Available public jobs must be published, unexpired, and owned by an active recruiter. Closed published details remain visible; drafts, archived jobs, and jobs of suspended recruiters are hidden.

## Health endpoints

- `GET /api/health`: liveness only, no database dependency.
- `GET /api/ready`: database connectivity check; returns a generic 503 when unavailable. This is not a migration/version check.

## Next phases

1. Client visual/content acceptance of the restored original public website and replacement of two unavailable guide illustrations. The design is intentionally preserved; modernization is a separate future scope. See [public-site.md](public-site.md).
2. Browser/mobile interaction acceptance, real merchant sandbox/live acceptance, staging, production VPS deployment, backups, and cutover.

Statement-backed resolution of uncertain charges, safe original-submission retries and manual reversal recording are implemented. Money is returned outside the app; no Daraja reversal integration is planned. See [payment-review.md](payment-review.md).

Applicant profiles, private PDF CV storage, ClamAV scanning command, and private application drafts are implemented. Drafts snapshot fees and use version checks. Storage currently uses a private single-server filesystem adapter; S3 remains a later adapter option. See [applications.md](applications.md).

M-Pesa checkout freezes profile/CV/job terms, checks eligibility and the original fee, and prevents draft changes while payments are unresolved. Confirmed funds and eligible application submission commit atomically. Paid-but-ineligible applications retain received funds and require operator review rather than a second charge. See [payments.md](payments.md).

Recruitment review is implemented with tenant-scoped confirmed submissions, frozen profiles, application-scoped CV downloads, explicit decision transitions, applicant-visible immutable responses, and owner withdrawal. Responses/withdrawals create audit/history/outbox records. See [recruitment.md](recruitment.md).

The notification worker expands outbox events into per-recipient inbox alerts and separately delivers email with leases, backoff, and failed-work retries. Current permissions/preferences are checked again before sending. SMTP is at least once; dashboard alerts and business actions are deduplicated. See [notifications.md](notifications.md).
