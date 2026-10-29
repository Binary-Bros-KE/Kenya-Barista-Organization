# M-Pesa Paybill and Till payments

## Official references and implementation differences

Read the current [Daraja M-Pesa Express documentation](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate), including the Till FAQ, and [Authorization documentation](https://developer.safaricom.co.ke/apis/Authorization). The public query documentation route was not readable during implementation; query endpoint and request fields were cross-checked against [Safaricom's official PHP SDK](https://github.com/safaricom/mpesa-php-sdk/blob/master/src/Mpesa.php), particularly `STKPushQuery`. Its older Till limitations are superseded by the current Express documentation.

| Field | Paybill | Buy Goods / Till |
| --- | --- | --- |
| `TransactionType` | `CustomerPayBillOnline` | `CustomerBuyGoodsOnline` |
| `BusinessShortCode` | Onboarded Paybill shortcode | HO/store shortcode used for Daraja go-live |
| `PartyB` | Paybill shortcode | Customer-facing Till number |
| STK password | Base64(shortcode + passkey + timestamp) | Same formula using the onboarded HO/store shortcode, independently of the Till number |

An HO number, store number, and Till number are distinct business identifiers. Enter the shortcode Safaricom onboarded for this integration; do not assume the displayed Till number is the STK business shortcode. Keep sandbox and live credentials separate. STK sandbox test data must come from the current Daraja simulator; both code paths exist, but a successful sandbox Paybill simulation does not certify a live Till configuration.

## Setup

From the project directory, with the database running:

```powershell
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run payments:setup
```

`payments:setup` creates a random `PAYMENT_ENCRYPTION_KEY` in ignored `.env` if one does not already exist. It never prints the key or replaces a populated one. This is separate from `AUTH_SECRET`. Back up the key securely outside the database backup. Losing it makes saved merchant credentials, payer data, and receipt evidence unreadable. Changing it requires an offline re-encryption migration; do not regenerate it to rotate Daraja credentials.

Set `PAYMENT_CALLBACK_BASE_URL` to a public HTTPS **origin**, with no path, query, credentials, or fragment. For local testing, use a tunnel forwarding to the application; for deployment, use the actual HTTPS application domain. The backend constructs an individual `/api/payments/notify/[token]` URL for each request. Do not place a Daraja API URL in this setting.

The app defaults to one database connection in development to accommodate the embedded Prisma dev protocol bridge. Use `DATABASE_POOL_MAX=1` with Prisma dev, including when testing a production build locally. Native PostgreSQL deployments default to five connections; set `DATABASE_POOL_MAX=5` explicitly on the VPS. Database integration CI retains multiple connections on PostgreSQL 17.

Sign in as an administrator with a verified MFA session and open `/admin/payments`:

1. Select Paybill or Till and Sandbox or Live.
2. Enter a checkout label, the business shortcode, and the separate Till number when applicable.
3. Enter the consumer key, consumer secret, and STK passkey for that merchant/environment.
4. Enable the option and save. Configure the other type separately if both should be offered.

Secrets are encrypted with AES-256-GCM and authenticated against their owning record ID. Neither API reads nor server-rendered/client page data include secrets or ciphertext. Leave all three credential fields blank to retain the latest saved credentials for the same type and environment; provide all three when replacing them. Each save creates an immutable revision and disables the former revision for that type. Existing payment attempts keep the old revision for reconciliation. One enabled revision per type is enforced in PostgreSQL. Sandbox options cannot be selected or reconciled in a production process.

## Applicant checkout

Applicants select an enabled collection option; they do not enter or see business API credentials. Payment status and receipts appear on `/dashboard/payments` and the application detail page.

Checkout requires an active verified account, complete profile, exactly one attached CV with `CLEAN` scanning status and a stored digest, an available published job, and a saved current draft version. Fees come exclusively from the draft's original quote, as integer minor units in KES. The server converts to whole shillings for Daraja. New fee settings allow KES 1–250,000, matching the documented Express range; existing out-of-range fees are rejected at checkout.

The payer phone can differ from the applicant's profile phone. Both are retained for their appropriate purpose. The provider request uses the payer number in `PartyA` and `PhoneNumber`. The app never asks for an M-Pesa PIN.

When a prompt is reserved, the backend freezes the saved profile, cover letter, CV ID/digest, fee, and job/application versions, then prevents draft edits. Changing the profile afterwards does not change that application's frozen submission. One payment order exists per application, with separate attempts for resolved failures/retries.

## Confirmation and failure handling

| Situation | Outcome |
| --- | --- |
| STK request acknowledgement (`ResponseCode=0`) | Pending; application remains a draft |
| Callback success alone | Store matching evidence; application remains a draft |
| Server-side query confirms success and matching receipt evidence exists | Record payment and submit an eligible application in one transaction |
| Query confirms success but callback/receipt is missing | `NEEDS_REVIEW`; wait for callback, block further payment |
| Query confirms cancellation/failure | Unlock draft; allow a later new attempt with a new idempotency key |
| Ambiguous network timeout or crash after reserving an attempt | Hold payment for reconciliation; do not automatically send another prompt |
| Payment succeeds after deadline, job terms change, account suspension, or loss of eligibility | Record received funds, keep application unsubmitted, flag operator review, block another charge |
| Duplicate receipt used for another application | Hold for review; do not submit |

Daraja's documented Express payload does not provide a callback-signature scheme. The application uses an unpredictable per-attempt callback capability (only its SHA-256 hash is stored), matches request IDs, payer, amount, and receipt, and independently queries Daraja over authenticated HTTPS. A public callback cannot directly mark an application paid or submitted. Keep callback URLs private: redact `/api/payments/notify/*` from reverse-proxy access logs, tracing, and analytics. Never log request bodies, Daraja Authorization headers, STK passwords, or raw provider responses.

Incoming callbacks are bounded JSON requests and deduplicated. An early callback can be stored before the initiation acknowledgement is saved; confirmation still waits for identifiers obtained from the outbound request. If the initiation response was lost and those IDs cannot be trusted, the application stays in operator review. Query-only success without a receipt is deliberately not treated as a complete submission.

The owner page automatically checks pending/review payments every 30 seconds while open; the manual Check button is also available. Administrators can recheck pending orders on `/admin/payments`. Database leases and a minimum query interval prevent overlapping provider queries. Request idempotency keys, account-level reservation locks, a database constraint allowing one unresolved attempt per order, and unique receipt IDs protect against duplicate prompts/submissions. Requests are limited to one per minute and five per hour per account.

## Background reconciliation

```powershell
npm.cmd run payments:reconcile
```

Each invocation considers up to 25 due pending/review attempts. Provider calls occur outside database transactions. Exceptions leave attempts available for later retry and produce a nonzero command exit status; output contains counts rather than payer data or secrets. Schedule this command every minute on the VPS with the same environment and encryption key as the web process. The command is safe to run alongside page checks because each attempt uses a database lease.

Application submission writes status history, an audit entry, and a deduplicated `application.submitted` outbox event. The notification worker delivers dashboard alerts and configured email.

Manual reversal recording is implemented as described below. Statement-backed administrator resolution is available in the [payment review queue](payment-review.md), including receipt confirmation, guarded no-charge resolution, and retries of eligible original paid submissions. Administrators must inspect the original merchant statement; applicant claims and missing callbacks alone are insufficient. Reversal API calls and statement import are not implemented.

## Routes

| Route | Access and action |
| --- | --- |
| `GET/POST /api/admin/payments/settings` | MFA administrator: read safe configuration metadata / create a credential revision |
| `GET /api/admin/payments` | MFA administrator: latest 100 payment orders, safe fields only |
| `POST /api/admin/payments/[id]/refresh` | MFA administrator: requery latest attempt, subject to the query lease |
| `GET /api/applications/[id]/payments` | Owner: payment summary |
| `POST /api/applications/[id]/payments` | Owner: initiate `{ configurationId, phone, idempotencyKey, version }` |
| `POST /api/applications/[id]/payments/refresh` | Owner: requery latest attempt |
| `POST /api/payments/notify/[token]` | Provider callback capability; no session/origin requirement; cannot independently confirm payment |

All account mutations require the configured same origin. No endpoint accepts a browser-supplied amount, receipt, paid flag, or transaction result as proof of payment.

## Verification and remaining acceptance checks

Automated tests use injected Daraja responses, not real charges. They cover separate Till/Paybill payloads, encryption/tamper detection, settings MFA, secret redaction, snapshot eligibility, duplicate clicks, callback mismatches/replay, early/late callbacks, receipt uniqueness, cancellation, retry, ambiguous initiation, credential revisions, and job changes after payment starts. Native PostgreSQL CI is configured but must still run; the local embedded database suite uses one connection because its protocol bridge failed nested concurrent relation reads with multiple connections.

For all database tests, set `AUTH_TEST_DATABASE_URL`, `JOB_TEST_DATABASE_URL`, `APPLICATION_TEST_DATABASE_URL`, and `PAYMENT_TEST_DATABASE_URL` to an isolated local test database, set `DATABASE_URL` to the same database and `RUN_DB_TESTS=true`, then run `npm test`. Never use the normal development database for integration fixtures.

For the embedded payment test database, start `npx.cmd prisma dev --name barista-payment-tests --port 55213 --db-port 55214 --shadow-db-port 55215` and use `postgres://postgres:postgres@localhost:55214/template1?sslmode=disable` for those test URLs. Apply migrations before running tests. Close the disposable shell or clear all test environment variables afterwards.

Before live launch, test both merchant configurations with actual Daraja sandbox credentials, a reachable HTTPS callback, a real ClamAV-approved CV, and the configured reconciliation schedule. Then perform controlled live acceptance for the actual onboarded Paybill/Till, including cancellation, lost callback, and operator review. No real Daraja credentials, sandbox STK calls, live charges, browser visual QA, or VPS deployment were available/performed during this implementation.


## Manual reversals (16 October 2026)

Money is returned manually outside this application. There are no Daraja reversal requests or reversal credentials. An MFA administrator uses **Mark payment reversed** on the payment administration screen after returning the full original payment to the original payer, supplying a unique reversal reference, a private note, and explicit confirmation of completion.

POST /api/admin/payments/[id]/reverse accepts only attemptId, reference, note, and confirmedReturnedToPayer: true. The server derives the full amount and currency from the original order. It accepts only confirmed, receipted successful attempts on paid orders without unresolved attempts or an existing refund workflow. Partial refunds are not supported. A reversal is final in the application; there is no edit/delete endpoint.

The order lock serializes duplicate requests. Repeating the same attempt and reference returns the existing record; a different reference conflicts. Refund, payment status, private review entry, audit log, and applicant notification event commit together. The persisted payment status REFUNDED is displayed as REVERSED. The original receipt, paidAt, submitted application, recruitment decisions, and application history remain intact. A reversal does not withdraw an application or allow a second checkout.

Applicants see their own reversal reference and completed record in Payments and the payment summary API. Operator notes and administrator identities remain private. The existing notification worker delivers a generic applicant-only reversal alert, with no private notes. Marking the record does not verify or move funds; the administrator is responsible for the external transfer and its evidence.
