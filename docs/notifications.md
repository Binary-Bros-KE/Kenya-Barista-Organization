# Background notifications and delivery

The database outbox now feeds dashboard alerts and background email for job and application updates. Each event creates at most one alert per recipient. Email has its own delivery attempts, so a failed email does not remove the dashboard alert or repeat the underlying recruitment/payment action.

## User and administrator pages

- `/dashboard/notifications`: paginated inbox, unread filter, mark as read, and job/application email preference.
- `/admin/notifications`: MFA-protected queue counts, oldest pending event, failed event/email lists, and manual retries.

Dashboard notifications remain enabled when notification emails are disabled. Preferences apply to job/application updates. Account verification/reset messages and employer invitations retain their existing direct delivery paths and are not controlled by this preference or retried by this business-notification worker.

## Covered events

| Event | Recipients |
| --- | --- |
| Application submitted | Applicant confirmation and active employer members |
| Recruitment response/status decision | Application owner |
| Application withdrawn | Owner confirmation and active employer members |
| Job submitted for review | Active employer members and active verified platform administrators |
| Job changes requested | Active employer members only |
| Job withdrawn from review | Active employer members only |
| Job updated, published, closed, archived, or reopened | Active employer members and owners of active drafts/submissions for that job |

Active job followers are applicants in Draft, Submitted, Under review, or Shortlisted status. Hired, rejected, or withdrawn applications do not receive later job-update emails. This phase does not introduce public subscriptions or marketing campaigns.

Emails use generic subjects and short messages linking to protected dashboard pages. They contain no CVs, recruitment message body, reviewer notes, M-Pesa credentials, payment callback tokens, or account recovery tokens. Job-review notices never go to applicants. The inbox stores the same generic content; detailed responses remain on the authorised application page.

## Run locally

Keep the database running and apply the migration:

```powershell
npm.cmd run db:deploy
npm.cmd run db:generate
```

Run a single bounded batch:

```powershell
npm.cmd run notifications:run
```

Or keep a worker running in another terminal:

```powershell
npm.cmd run notifications:work
```

Continuous mode polls every 10 seconds and stops after the current batch when it receives SIGINT/SIGTERM. The worker uses the same DATABASE_URL, APP_URL, and email settings as the web process. It processes existing pending outbox events, including events recorded before this phase.

With `EMAIL_MODE=file` and a loopback development APP_URL, accepted messages are private files in ignored `.dev-mail/`. Use the existing `mail:preview` command to inspect them. Stable notification Message-IDs produce deterministic filenames; completed preview files are published atomically, avoiding duplicate or partial JSON previews during retries. The mailbox is not publicly served. File mode is refused in production or for a public APP_URL.

No worker was run against the normal development database during implementation. Only isolated disposable test accounts received local preview files. Real SMTP delivery requires your SMTP configuration.

## SMTP configuration

Use `EMAIL_MODE=smtp`, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM, and matching SMTP_USER/SMTP_PASSWORD where the server requires authentication. The SMTP transport requires TLS: implicit TLS when SMTP_SECURE=true, otherwise STARTTLS. Connection, DNS, greeting, socket, and total-send timeouts bound each attempt. See [Nodemailer's transport documentation](https://nodemailer.com/smtp) for server settings.

SENT means the SMTP server accepted the recipient, or the development preview was written; it does not prove inbox placement. SMTP acceptance and rejection are checked using [Nodemailer's result fields](https://nodemailer.com/extras/smtp-connection). Bounce handling, provider delivery webhooks, and spam-folder tracking are not implemented.

The worker sends one recipient per message. A stable Message-ID helps correlate attempts, but SMTP does not provide a transaction shared with PostgreSQL. If the server accepts an email and the worker dies before recording SENT, a retry can produce a duplicate email. Database alerts and business actions are deduplicated; email delivery is at least once, not guaranteed exactly once. The administration page explains this when retrying failed emails.

## Reliability and privacy

Event expansion and delivery have independent two-minute leases with random ownership tokens. An expired lease can be reclaimed; completion/failure updates must still own that lease. Event expansion creates alerts and advances its cursor in one database transaction. Recipients are processed in pages of 100, allowing large events to resume without recreating earlier alerts. One invocation handles up to 20 event pages and 25 email attempts.

Failures retry with exponential delays starting at one minute. After five failures/attempts, work is retained as failed for administrator review. A worker that crashes on the final delivery attempt is moved to failed after its lease expires rather than remaining pending forever. Failed event retries retain their recipient cursor; failed email retries retain their existing alert and Message-ID. Only failed inactive work can be manually retried, with an audit entry.

Before sending, the worker rechecks current account activity, email verification, preference, organisation membership, and event relevance. Revoked/suspended employer access also hides those employer alerts from the inbox and prevents marking them read. Platform-admin alerts require current role and current-session MFA when viewed in the application. Notification email links still require normal sign-in/MFA to open their destination.

Skipped emails are final: re-enabling email or restoring membership does not resend earlier skipped work. Messages that are no longer relevant, such as pending job-review requests after publication or recruitment responses after withdrawal, are skipped at delivery. Dashboard history may still show older authorised generic alerts.

Failure records contain fixed codes such as EMAIL_DELIVERY_FAILED, ACCESS_REVOKED, EMAIL_DISABLED, ACCOUNT_UNAVAILABLE, and UNSUPPORTED_EVENT. Raw SMTP responses, credentials, message bodies, or recipient addresses are not written to worker logs. The MFA-only administration page shows the failed recipient address so an operator can investigate configuration or address problems. CLI output contains batch counts; skipped deliveries count as processed, not as sent.

## Deployment

Run one or more worker processes under the VPS process manager with the same release and environment as the web application. Alternatively run `notifications:run` from a scheduler. A single call processes a bounded batch, so schedule frequently enough for the expected backlog. Monitor the worker process and `/admin/notifications`; queue counts alone are not a heartbeat. The oldest pending event and failed lists help diagnose stalled work. Worker launch, SMTP credentials, SPF/DKIM/DMARC, and real delivery acceptance are part of VPS deployment.

## API

| Route | Access |
| --- | --- |
| `GET /api/notifications?page=1&unread=true` | Current user, filtered by current access |
| `POST /api/notifications/[id]/read` | Current authorised recipient only |
| `GET/PUT /api/notifications/preferences` | Current user's `{ emailEnabled }` preference |
| `GET /api/admin/notifications` | MFA administrator: queue metrics and latest 50 failures per type |
| `POST /api/admin/notifications/retry` | MFA administrator: `{ target: "event" or "delivery", id }` |

Mutations require the configured same origin. No HTTP endpoint accepts arbitrary recipients or email content, sends a batch, or exposes the private preview mailbox.

## Verification

Automated tests use captured senders and private development previews, with no external messages. They cover event/recipient deduplication, concurrent workers, expired leases, failed final attempts, backoff, failed-work retries and MFA, owner-only read controls, preferences, revoked access, account suspension/verification, sensitive-content exclusion, review-only recipients, and multi-page fanout.

For an isolated local database, run `npx.cmd prisma dev --name barista-notification-tests --port 57213 --db-port 57214 --shadow-db-port 57215`. In a disposable terminal set DATABASE_URL and NOTIFICATION_TEST_DATABASE_URL to `postgres://postgres:postgres@localhost:57214/template1?sslmode=disable`, apply migrations, set RUN_DB_TESTS=true, and run the notification test suite. For all tests, set AUTH, JOB, APPLICATION, PAYMENT, RECRUITMENT, and NOTIFICATION test database URLs to that same isolated database before `npm test`. Never use normal development or live data for integration fixtures. Native PostgreSQL CI is configured with multiple connections; local embedded tests use one for the payment/recruitment/notification suites.

Real SMTP delivery, bounce processing, browser visual/mobile acceptance, VPS process supervision, and native PostgreSQL CI execution were not verified locally. Manual reversal records and statement-backed payment reviews are implemented. Their generic applicant-only updates use this worker without including private operator notes or evidence references. Remaining major work is the public website content/rebuild and launch acceptance.
