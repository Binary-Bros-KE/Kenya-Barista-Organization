# Modernization stages

The owner approved modernizing both the application and public website. Complete the dashboard first, then the website. Each stage is implemented, committed, pushed, checked in GitHub and verified after automatic staging deployment. Present the next stage for the owner's go-ahead before beginning it. Preserve the existing recruitment, access, payments and manual-reversal rules.

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Responsive coffee-themed sidebar, mobile drawer, logo and contextual header | Deployed |
| 2 | Dashboard overview: real role-aware summaries, recent work, account essentials and quick actions | Deployed |
| 3 | Profile and CVs: clear form sections, upload/screening states and document management | Deployed |
| 4 | Applicant applications, details, responses and withdrawal experience | Deployed |
| 5 | Applicant payments and notification inbox | Deployed |
| 6 | Security, authenticator setup and remaining account states | Deployed |
| 7 | Employer organisations, job editor/listings and applicant review | Deployed |
| 8 | Administration: accounts, organisations, job review, payment settings/review and delivery queue | Deployed |
| 9 | Public website design direction, homepage and shared navigation/footer | Deployed |
| 10 | Courses, about/philosophy, team, gallery, contact and coffee guides | Deployed |
| 11 | Public jobs/detail/application entry and authentication pages aligned to the new website | Current stage |
| 12 | Cross-device visual, keyboard and end-to-end journey polish | Awaiting go-ahead |

Use actual records and honest empty states. Platform summaries and review queues require administrator MFA. Personal account summaries and notifications must preserve ownership and existing visibility rules. Schema changes remain separately reviewed; these visual stages should not need them.

Stage 2 uses only read queries, reuses profile validation and notification audience filtering, and leaves all existing detail tabs/workflows in place. Charts with invented data and misleading “live” counters are excluded. Counts refresh on page navigation/reload. Mobile layouts use stacked panels and readable status rows.

Stage 4 preserves owner filtering on every application list/count query and existing detail/response access checks. Status filters retain pagination context. Draft editing retains version checks, screening eligibility and payment locks. Responses are rendered as text in Nairobi time. Withdrawal retains explicit confirmation and never initiates a payment reversal.

Stage 5 keeps payment records and summaries scoped to the applicant, and reuses notification audience/MFA filtering. Completed manual reversals show recorded references; no automated reversal API is called. Checkout retains its idempotency keys, payment holds and polling behavior, with corrected browser phone validation and reversal wording. No schema changes.

Stage 6 keeps administrator MFA mandatory and applicant MFA optional. Session verification comes from the server, not a local success flag. Setup keys/recovery codes stay in component memory, remain hidden until revealed and are cleared after successful verification. Recovery-code downloads require a user action, and a saved-code acknowledgement still gates initial verification. No account, session or database policy changes.

Stage 7 modernizes organisation workspaces, posting cards/editor/workflow history and applicant search/review. Job approval actions, unsaved-change guards, fee authority, organisation membership/suspension checks, paid-submission scope, frozen applicant snapshots and CV protections remain enforced by the existing services. No schema or permissions changes.

Stage 8 gives administration consistent navigation, responsive management cards and confirmations for access changes. Loaded-record search is explicitly limited to the latest 50 records. Payment evidence, merchant credential revision/encryption rules, manual reversal confirmation and retry semantics are unchanged. Administration still requires server-verified MFA. No schema changes.

Stage 9 introduces a cream/forest-green editorial homepage and shared public header/footer using existing KBO assets, mission and contact details. Course registration and job-account registration remain distinct. Navigation preserves all public, guide, sign-in and workspace routes, with native modal mobile navigation. Inner content pages retain their existing content for the following stages. No invented statistics, testimonials, course fees or employment guarantees; no schema or authentication changes.

Stage 10 modernizes courses/enquiries, philosophy, team, gallery/product showcase, contact and all four guide frames. Existing team details, core values, course brochures, product images and complete guide HTML are retained. Course fees/dates require confirmation with KBO. Enquiries still prepare an email draft rather than submit to a server. Gallery retains modal keyboard navigation and focus restoration; article tabs/accordions retain their existing behavior. No schema, account or payment changes.

Stage 11 aligns public job search, cards, detail and application entry with the website, and embeds every authentication/invitation page in the shared public frame. Existing query validation, visibility filters, fee/deadline data, account endpoints, MFA and application submission rules remain unchanged. No schema changes.
