# Payment exception handling

MFA administrators open **Payment settings and history → Open payment review queue**, or `/admin/payments/review`. The queue is paginated, oldest first. It includes charges marked NEEDS_REVIEW, pending attempts at least ten minutes old, held orders, and paid applications that remain drafts. Every order also has a review detail link from payment history.

## Review actions

- **Add private note:** records a note without changing the payment result or notifying the applicant.
- **Confirm a statement receipt:** requires the original receipt, full amount, payer mobile number, receiving Paybill/Till, statement/case reference, private note, and explicit statement-check confirmation. The merchant and encrypted payer must match the attempt's original configuration, including after credential rotation. Till receipts match the receiving Till number; Paybill receipts match the business shortcode. Receipt references are normalized to uppercase and must be unique. Production rejects sandbox confirmations.
- **Statement confirms no charge:** requires the same statement attestation and evidence reference. Only the latest unresolved attempt at least ten minutes old is eligible, without receipt, success callback evidence, success query result, prior paid funds, another unresolved attempt, or an active provider query lease. This records FAILED and permits editing/retry only if no older charge evidence holds the order. Missing SMS/callbacks alone are insufficient evidence. Ten minutes is an application safeguard, not a claim that M-Pesa can never send a later result.
- **Retry original paid submission:** retries the original frozen application after a temporary obstacle has been corrected. It never overrides changed job terms, expired/closed jobs, suspended organisations/accounts, changed application versions, invalid snapshots, mismatched fees, or unavailable/unsafe CVs. Permanently ineligible applications require applicant contact and any agreed manual reversal.

Statement confirmation is an administrator attestation based on external merchant records. The application cannot independently authenticate a statement reference. It preserves any actual provider query result and records the statement decision separately. It does not use an applicant-provided receipt as payment proof, initiate another STK prompt, or move/refund funds during review.

## Submission and duplicate-charge safety

Provider reconciliation and administrator confirmation share the same settlement function. It validates the frozen profile/snapshot, original fee/currency, application/job versions, account status, published deadline, organisation status, and private CLEAN CV identity/digest. An eligible original application submits once, atomically with payment settlement, status history, and its deduplicated notification event. Received funds remain recorded when the application cannot submit.

Clearing a request does not make late evidence disappear. A successful callback after FAILED/CANCELLED stores the evidence, sets a review hold, and records one system review entry per distinct callback. Callback replay does not duplicate that entry. The hold blocks checkout and draft edits on the server and is visible to the applicant. Administrators cannot clear success evidence as no-charge.

An older late receipt cannot submit a newer edited snapshot. Resolve any newer unresolved attempt first; clearing it preserves the hold if older evidence remains. Statement confirmation then records the older funds for review/manual reversal without submitting the newer draft. Manual reversal stays entirely external: after completing it, record its reference using the existing reversal action. A completed return clears the hold only when all confirmed charges are reversed and no unconfirmed late evidence remains.

## Concurrency, privacy, and audit

All actions require current administrator access and session MFA through the existing same-origin API wrapper. JSON inputs are strict and bounded. Reviews carry the displayed order version; stale decisions return 409 and require a reload. Provider status/evidence changes increment that version. Review, reconciliation, callback handling and reversal use consistent row-lock order. Active query leases block financial review decisions.

Each decision records the actor, action, private note, evidence reference and time, plus an audit entry. Review history has no edit/delete endpoint; the detail page shows the latest 100 entries and older records remain in the database. Details expose original merchant metadata and transaction identifiers, never credential ciphertext, encrypted payer data, callback capabilities or frozen CV/profile snapshots. An applicant can see only their own payment status and receives a generic resolution notification. Private notes/evidence references stay in administration. Notification delivery uses the existing background worker.

## Routes and setup

| Route | Purpose |
| --- | --- |
| `/admin/payments/review?page=1` | MFA-only exception queue, 20 orders per page |
| `/admin/payments/[id]` | MFA-only order, original attempts, review forms and history |
| `GET /api/admin/payments/[id]/review` | Safe administrator review detail |
| `POST /api/admin/payments/[id]/review` | Strict versioned NOTE / CONFIRM_RECEIPT / NOT_CHARGED / RETRY_SUBMISSION action |

This phase uses the existing payment-administration schema; no new migration is required. Keep `PAYMENT_ENCRYPTION_KEY` unchanged so original payer records remain readable. Restart the app/worker to load the new code. Real merchant statement reconciliation, browser/mobile visual acceptance, native PostgreSQL CI, and VPS deployment remain launch acceptance tasks.
