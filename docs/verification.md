# Foundation verification — 15 October 2026

Verified on the local Windows workspace:

- Prisma schema validation passed; client generated successfully.
- Initial SQL migration applied to the project's named local Prisma Postgres instance.
- Guarded seed created the development organisation without accounts or payments.
- All four tests passed, with the database test enabled and no skipped tests.
- TypeScript checks and the final production build passed.
- Production HTTP checks: homepage, linked JavaScript/CSS assets, liveness, and database readiness returned 200; an unknown page returned 404.
- With the database stopped, readiness returned a generic 503 without database credentials.
- Restarting the named database preserved the migration and seeded organisation; test application fixtures were rolled back.
- Final production server started without the standalone-output warning.
- npm audit reported zero known vulnerabilities at verification time.
- `.env` and generated Prisma files are ignored by Git; `.env.example` is available for source control.

Limits: local database checks used Prisma's PGlite-backed development server. Standard PostgreSQL 17 migration checks are configured in GitHub Actions but have not been run on GitHub. No browser-based visual/accessibility testing, VPS deployment, or live integrations were performed in this foundation phase.

The development database and temporary web server were stopped after verification. Start the database with `npm.cmd run db:local` and the app in another terminal with `npm.cmd run dev`.

## Account and employer-access phase — 15 October 2026

- Account migration applied first to a separate local test instance, then to the normal development instance. Both migrations are recorded and the original demo organisation remains intact.
- Final regression run: 13 tests passed, zero failures and zero skips. Tests covered unverified login, attempted role escalation, one-time bootstrap, per-session administrator MFA, stale pre-enrollment sessions, single-use recovery codes, invitation expiry/revocation/replay, employer isolation, suspension, password reset/session revocation, sign-out, expired sessions, origin checks, and login throttling.
- Real Next.js HTTP checks on a separate port passed for public account pages, unauthenticated redirects/API denial, signup, post-response development email delivery, email verification, the actual bootstrap CLI, MFA enrollment and admin gating, organisation creation, invitation acceptance, cross-organisation denial, safe admin listing responses, suspension, and sign-out.
- Custom mutation origin checks and the 16 KiB JSON request limit were verified over HTTP.
- TypeScript checking and the final production build passed.
- npm audit reported zero known vulnerabilities after adding authentication and email dependencies.
- Development email files, temporary test files, and temporary Next.js output are ignored by Git. Disposable HTTP-test accounts, organisations, and mail files were removed.

No administrator was created in the normal development database; the owner must register and verify their intended account, then run the documented bootstrap command. SMTP delivery to a real provider, standard PostgreSQL CI execution, browser-based UI testing, and VPS deployment remain unverified. Local account flows use the development mailbox. The background notifications worker and durable mail retries remain a later phase.

See [accounts.md](accounts.md) for setup, mailbox, administrator, and employer-invitation instructions.

## Job posting and public discovery phase — 16 October 2026

- The additive job migration was applied to the isolated job-testing instance and the existing development instance without a reset.
- Full regression run: 23 tests passed, zero failures and zero skips. New cases covered administrator-only fees, membership scoping, private drafts, explicit approval, required review feedback, concurrent edit conflicts, re-review after published edits, application fee locking, deadline expiry, replay-safe scheduled closing, archiving, search pagination, and Nairobi timezone conversion.
- Real Next.js HTTP checks passed for the rebuilt home page, original logo, public search/detail routes, protected job workspaces, fee configuration, organisation isolation, submission/review/publication, edit conflicts, private-field exclusion, expiration, the scheduled-closing CLI, and archiving.
- A Unicode description larger than the former 16 KiB limit was saved through the job API successfully. A description containing script markup rendered as escaped text in the public HTML, while private reviewer feedback was absent.
- Draft and archived public URLs returned 404; expired previously published jobs retained a closed detail page and disappeared from available results.
- TypeScript checks and the final production build passed.
- Temporary HTTP-test accounts, organisations, jobs, fee settings, and development email files were removed from the isolated test environment.

Limits: database checks used local Prisma Postgres/PGlite. Standard PostgreSQL 17 CI is configured but has not been run on GitHub. No browser-controlled visual testing, VPS deployment, live application submissions, payments, or job-notification delivery were performed. Job events are recorded for the future worker; recurring closure scheduling will be configured with deployment. Application submission and private documents are the next phase.

See [jobs.md](jobs.md) for the fee setting, workflow, routes, and verification commands.
# Applicant phase — 16 October 2026

- The final production build passed without warnings after excluding runtime upload paths from deployment asset tracing.

- Prisma schema validation, migration deployment to an isolated local database and the normal development database, and TypeScript checks passed.
- All 33 automated tests passed with database tests enabled. New checks cover profile input, idempotent drafts, fee snapshots, ownership, CV quarantine, attachment restrictions, stale saves, immutable submitted records, unavailable jobs, and concurrent upload quotas.
- PDF size/format screening and the ClamAV wire protocol were tested. A local protocol test server exercised clean, infected, malformed, and incomplete replies; no live ClamAV daemon or malware database was available.
- Local HTTP verification used disposable accounts with actual email verification and signed-in sessions. Profile, public Apply, draft list/detail, CV upload/download/deletion, cross-account denial, origin checks, 5 MiB limit, and stale-save conflicts passed.
- No browser visual QA, external SMTP delivery, real payment, or VPS deployment was performed. Filesystem storage is implemented; S3 is deferred. Pending CVs do not represent a successful malware scan. Final submission remains unavailable until the payment phase.

# Payment phase — 16 October 2026

- Final production build, including TypeScript and route generation, passed without build warnings. Re-running payment key setup retained the existing key.

- Read Safaricom's current Express and Authorization documentation, including the separate HO/store shortcode and Till-number mapping. Cross-checked the query endpoint against Safaricom's SDK; the public query documentation route was not readable.
- Migration deployed to a dedicated local payment database and the normal development database; Prisma schema validation passed. Generated a separate local payment encryption key without exposing it.
- All 51 automated tests passed, with database integration suites enabled. Payment tests cover both collection types, credential encryption and retention, MFA, owner scoping, idempotent concurrent clicks, draft freezing, callback replay/mismatches, early/late callbacks, independent query confirmation, frozen submissions, cancellation/retry, duplicate receipts, changed job terms/deadlines, and ambiguous initiation.
- The embedded Prisma dev database produced a protocol error on concurrent nested relation reads with multiple connections. Its payment suite passes with one connection; runtime development defaults to one and supports DATABASE_POOL_MAX. Native PostgreSQL CI remains configured with multiple connections and has not been run here. The installed pg driver also emits a dependency deprecation warning about overlapping queries.
- HTTP checks with actual verified sessions passed for both merchant settings, credential retention and redaction, admin MFA, same-origin protection, applicant payment pages, cross-account denial, profile/CV readiness rejection, unknown callbacks, and refusal of browser-supplied fees. No provider payment calls were made during HTTP verification.
- Payment behavior was tested with injected provider responses. Real Daraja sandbox/live calls, real merchant acceptance, browser visual QA, live ClamAV, external SMTP, and VPS deployment remain unverified. Refunds and manual review resolution are deferred to payment administration.

# Recruitment phase — 16 October 2026

- Recruitment migration applied to the isolated test database and normal development database without resetting data; Prisma schema validation and client generation passed.
- All 64 automated tests passed with database integration suites enabled and no skipped tests. New coverage includes confirmed-submission visibility, organisation boundaries, current MFA/membership/suspension checks, frozen profiles, CV scanning/digest/file checks, stale/future versions, recruiter races, applicant withdrawal races, immutable responses, terminal decisions, pagination, and damaged submission/payment records.
- HTTP checks used real verified accounts and MFA sessions with disposable fixtures in the isolated database. Employer review pages, confirmed-only filters, scoped CV downloads, owner timelines, escaped response text, stale writes, withdrawal, preserved payment, revoked membership, and same-origin protection passed. Test payment records were created directly in that isolated database; no Daraja request or charge occurred.
- Final production build, including TypeScript and route generation, passed without build warnings. Local payment/recruitment tests use a single connection for Prisma dev; native PostgreSQL CI is configured with five and has not been run here. The existing pg dependency deprecation warning remains in payment tests.
- Recruitment updates are visible in the dashboard and enqueue outbox events. Background email delivery remains the next phase. No visual browser/mobile QA, real Daraja acceptance, live ClamAV/SMTP, or VPS deployment was performed.

# Notification phase — 16 October 2026

- The notification migration was applied to the normal development and isolated test databases. Inbox alerts, email preferences, durable event expansion, delivery attempts, leases, backoff, failed-work retries, and MFA-only operations are implemented.
- All 78 automated tests passed with database suites enabled and no skipped tests. Notification coverage includes 103-recipient resumable fanout, concurrent workers, owner/read controls, preferences, revoked membership, suspended/unverified accounts, private content exclusion, expired leases, last-attempt crashes, retry limits, and atomic deduplicated local preview files.
- Real-session HTTP checks passed for inbox/read actions, preferences, CSRF, admin MFA and queue operations, manual retry, and opt-out revalidation. The worker CLI created private development previews for disposable test accounts; no external emails were sent.
- Repaired a CommonJS entry-point incompatibility in the notification worker, payment reconciliation, and CV scanning scripts. The latter two commands started successfully against the empty isolated database and reported zero work; no Daraja or live scanner call was made.
- TypeScript and the final production build passed without build warnings. Prisma printed an informational upgrade notice; versions were retained. The existing pg dependency deprecation warning remains in payment tests.
- Native PostgreSQL CI, real SMTP inbox delivery, bounce handling, browser visual/mobile QA, and VPS process supervision remain unverified. Account verification/reset and invitation emails retain their direct delivery paths; this durable worker covers job/application updates.

# Manual reversal recording — 16 October 2026

Implemented the client's requirement for manual money reversals: an MFA administrator records a completed external return with a reference and private note. No Daraja reversal requests are made. Full amounts are derived from the confirmed original payment, duplicate submissions are serialized, and recording preserves recruitment/application history. Applicant summaries expose the reversal reference and completion time without private notes. A generic applicant-only outbox notification is created atomically.

Verified with **79 passing tests, zero skips**, against the isolated local database `barista-manual-reversal-tests` on port 59214. The payment suite covers MFA and role denial, strict input validation, wrong attempt rejection, concurrent duplicate recording, conflicting references, immutable original amounts, preserved submitted applications, private-note redaction, applicant-only notification expansion, and refusal to reverse pending payments. All eight migrations applied to the fresh database. TypeScript checking and the production build passed.

The first test run exposed an incorrect Prisma relation name in notification expansion and fixture cleanup; both were corrected before the passing full run. A Prisma reset of the earlier disposable database was blocked and abandoned; no reset occurred. That database retains isolated test fixtures. Tests were rerun against a fresh database instead.

This phase did not perform real money transfers, Daraja reversal calls, external SMTP delivery, VPS deployment, native PostgreSQL CI execution, or browser visual/mobile QA. No additional HTTP acceptance suite was run for this change; same-origin/session/MFA route wrappers are reused, with the business action exercised in database integration tests. Remaining statement-backed resolution of uncertain charges is separate work.

## Payment exception review - 16 October 2026

- Added an MFA-only paginated exception queue and order detail/history page, private notes, statement receipt confirmation, guarded aged no-charge resolution, and retries of eligible original paid submissions. Financial decisions require a statement/case reference and explicit attestation. Till and Paybill confirmations check the original receiving merchant independently of current credential settings.
- Provider and manual settlement share snapshot/CV/fee/version eligibility checks. Manual confirmation preserves the actual provider result rather than inventing a successful query. Late success evidence after failure/cancellation holds checkout and draft editing, is deduplicated on replay, and cannot submit a newer edited snapshot. Clearing a newer no-charge attempt preserves any older evidence hold. Completed manual reversals remain external money movements and clear holds only after all relevant charges are resolved.
- The full automated suite passed **89 tests with zero skips** against the isolated local `barista-payment-review-tests` database on port 60214. After the final provider-result preservation adjustment, the focused payment suite passed **26 tests with zero skips**, including its new assertion. Coverage includes MFA, stale decisions, original payer/merchant/amount, receipt uniqueness/conflicts, leases, concurrent resolution, late callbacks, older attempts, ineligible paid applications, damaged snapshots, unchanged query versions, private notes and applicant-only notifications.
- Real-session HTTP acceptance passed on a separate local app at port 3108: anonymous/owner/MFA restrictions, CSRF, strict inputs, stale decisions, statement amount mismatch, secret redaction, owner-only payment summaries, paid-but-ineligible handling, and admin queue/detail rendering. Temporary accounts and payment fixtures were cleaned up. No real Daraja or external email calls occurred.
- This phase reuses the existing eight migrations; no new migration or production data change is required. Keep the existing payment encryption key. Restart deployed web/worker processes to load the new notification event handling. See [payment-review.md](payment-review.md).
- TypeScript checking and the final production build passed. The build used a separate ignored output directory to avoid disturbing an existing development server; test-only TypeScript includes were removed afterwards. The test app and isolated database were stopped after verification.
- Native PostgreSQL CI, actual merchant statement acceptance, real SMTP delivery, ClamAV service acceptance, visual/mobile browser QA, and VPS deployment remain outstanding. The next implementation phase is the public website rebuild and final organisation/course/contact content.

## Original public website restoration - 16 October 2026

- Followed the user's explicit direction to preserve the existing look and keep modernization outside this scope. Recovered original Vue templates, data and scoped styles from the owner's downloaded source maps. Rebuilt all ten original public routes with the original coffee/plantation heroes, logo, brown navigation, fonts, home sections, team, philosophy, courses, contact, gallery/product strip and coffee guides. Jobs/account navigation integrates the recruitment app.
- Retained seven archived team entries, ten values, 33 gallery photos and 31 product entries. Original images and four font families are locally hosted, including the embedded Feedback PNG and font license files. Two original farming illustrations remain unavailable (one external host returns 530; the other URL is 404); placeholders preserve their slots and descriptions. All gallery photos were recovered after retries.
- HTTP acceptance passed for all ten pages, expected content/navigation, original guide tables, safe static article output, separate course/applicant registration routes and **99 local image/font assets** (95 images and four fonts). Public job filter validation remains available. The first asset-check assumption about Content-Length was corrected to verify actual body bytes, since fonts can be streamed without that header.
- TypeScript checking and the production build passed. All restored public routes prerender successfully. Build/preview used separate ignored output folders to preserve an existing development server. No database migrations, external emails, old-site modifications, DNS changes or VPS deployment occurred. The owned preview on port 3109 was stopped after checks.
- Original contact/course templates had no working submission handlers. Restored enquiry forms explicitly prepare email drafts for the user to send; no server submission, enrolment storage or automatic external email is claimed. Job application/account/payment workflows keep their existing server logic.
- Browser-controlled desktop/mobile visual or interaction QA was unavailable. Pixel parity, hover/menu/tab/lightbox behaviour and actual email-client opening therefore remain acceptance checks. The client must confirm archived contact details, board information and course posters before launch. See [public-site.md](public-site.md) for provenance and the two missing illustrations. Existing backend database suites were not rerun for these scoped public UI/content changes; the prior payment phase's results remain recorded above.


## Website-branded account pages ? 29 October 2026

Prepared and built a separate UI release; seven authentication pages now share the original public site layout and logo, with a compact banner and original fonts/colors/footer. Auth form logic unchanged. Production build and focused rendered HTTP/CSS/asset checks passed. No browser-controlled visual QA was available. Activation awaits owner sudo; see auth-website-ui.md.
