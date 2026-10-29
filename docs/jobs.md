# Job posting, review, and public browsing

## Update and start

From this project folder, keep the database running in its own terminal:

```powershell
npm.cmd run db:local
```

In another terminal:

```powershell
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run dev
```

Restart an existing development application after regenerating the client. This phase adds job workflow columns, posting history, and platform fee settings without resetting account data. See [accounts.md](accounts.md) if you still need to create the initial administrator and enable MFA.

## Configure application fees

Sign in as an MFA-verified administrator and open `/admin/jobs`. Expand **Default application fee**, enter the amount in whole KES, and save it.

No fee amount is invented or seeded. Employers cannot create postings until the administrator configures a default. Administrators can also supply an explicit fee when creating an individual job. Fees are stored as integer minor units. Employers cannot override them, and changing the platform default affects new postings only. A job's fee cannot be changed after an application has been started, preserving later payment-order consistency.

The [payment workflow](payments.md) now collects the configured application fee through M-Pesa. Configure only whole KES within the supported range, KES 1–250,000.

## Employer workflow

1. Sign in with an active membership in an active organisation.
2. Open **My postings** at `/employer/jobs`, or open the organisation workspace and choose **Create a posting**.
3. Enter the title, plain-text description, location, category, employment type, and deadline. Deadline inputs explicitly use **Africa/Nairobi** time.
4. Save the draft and inspect the saved preview.
5. Choose **Submit for review**. The posting remains private until approved.
6. If changes are requested, read the private feedback, save revisions, and submit again.

Owners and recruiters can manage postings in their own organisations. Changing a job ID or organisation filter cannot grant access to another organisation. Suspended organisations and removed memberships lose employer access on subsequent protected requests.

Postings waiting for review must be withdrawn to draft before editing. Saving an edit to an already published posting immediately returns it to draft and removes it from public view until approved again. The editor explains this before saving. Published edits retain their public slug, so a reapproved posting uses the same URL.

## Administrator workflow

- `/admin/jobs` opens the review queue, with status filters and pagination.
- Select a posting to view its saved preview and private history.
- **Approve and publish** requires a submitted posting, active organisation, and future deadline.
- **Return with feedback** requires a private explanation of the requested changes.
- Administrators can create postings for active organisations through **Create job posting** and the same draft/review workflow.
- **Close applications** removes a published posting from available search results.
- A closed posting may be reopened as a draft, revised, and reviewed again.
- Drafts, returned postings, and closed postings may be archived. No hard-delete HTTP endpoint removes jobs or application history.

Every mutation uses an expected version. If two people save or review the same version, only one succeeds; the other receives a conflict asking them to reload. Status history, audit records, and durable transition events are committed in the same database transaction as the job change.

## Public pages

- `/` is the rebuilt KBO home page using the original logo and links into job discovery.
- `/jobs` supports keywords, case-insensitive location matching, category, employment type, employer, and pagination (12 results per page).
- `/jobs/[slug]` displays the description, employer, location, fee, and Nairobi deadline, with job-specific page/share metadata.
- Browsing requires no account.

Available results include only published jobs from active organisations whose deadlines have not passed. Private review notes, reviewer IDs, creator IDs, and workflow versions are not exposed by public job APIs. Descriptions render as text, not HTML.

A previously published closed or expired job retains a detail page showing that applications are closed. Draft, pending-review, returned, archived, and suspended-organisation jobs return not found publicly. Published edits returned to draft also remain private until reapproved.

Public job pages link to private application drafts. Applicant profiles and CV uploads are implemented in the [applicant phase](applications.md); [M-Pesa checkout and final submission](payments.md) are also implemented. Search indexing remains disabled until the production launch is ready.

## Deadline cleanup

```powershell
npm.cmd run jobs:close-expired
```

This command closes up to 100 expired published jobs per run, recording system history, audit events, and outbox events. Repeated runs do not create duplicate closures. Configure recurring execution during VPS deployment, with enough runs to clear larger batches. Independently of this command, the public availability query excludes expired jobs immediately, and their detail pages display a closed state.

Outbox events are recorded for workflow transitions and edits to published postings. Notification delivery and background-worker retries remain part of the later notifications phase; this phase does not email job updates.

## API routes

| Endpoint | Purpose |
| --- | --- |
| `GET /api/jobs` | Public filtered/paginated available listings |
| `GET /api/jobs/[slug]` | Public visible job detail |
| `GET /api/employer/job-options` | Permitted active organisations and current default fee |
| `GET/POST /api/employer/jobs` | Scoped management listing and draft creation |
| `GET/PATCH /api/employer/jobs/[id]` | Scoped private detail and versioned edit |
| `POST /api/employer/jobs/[id]/transitions` | Versioned workflow action; review actions require administrator MFA |
| `GET /api/admin/jobs` | Administrator management/review listing |
| `GET/PATCH /api/admin/settings` | Administrator fee configuration |

Creation accepts `{ organisationId, job: { title, description, location, category, employmentType, deadline } }`. Administrators may add `applicationFeeKes` inside `job`. Updates accept the same job fields plus `version`; the organisation cannot be reassigned. Transition bodies contain `{ version, action, note? }`.

Descriptions are limited to 12,000 characters. Create/edit bodies have a 64 KiB limit to support Unicode descriptions; other custom JSON APIs retain their 16 KiB limit. Custom mutations require the configured request origin. Public responses and management responses use no-store cache headers.

## Regression checks

Use a dedicated disposable local database, never the normal development database or one containing live jobs:

```powershell
npx.cmd prisma dev --name barista-job-tests --port 53213 --db-port 53214 --shadow-db-port 53215
```

In another terminal:

```powershell
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:53214/template1?sslmode=disable'
npm.cmd run db:deploy
$env:AUTH_TEST_DATABASE_URL = $env:DATABASE_URL
$env:JOB_TEST_DATABASE_URL = $env:DATABASE_URL
$env:RUN_DB_TESTS = 'true'
npm.cmd test
Remove-Item Env:AUTH_TEST_DATABASE_URL
Remove-Item Env:JOB_TEST_DATABASE_URL
Remove-Item Env:RUN_DB_TESTS
Remove-Item Env:DATABASE_URL
```

The job suite refuses the default development port, remote databases, databases with existing jobs, and databases with an existing administrator. It removes its fixtures and restores fee settings. CI is configured to run the account and job suites against standard PostgreSQL 17.
