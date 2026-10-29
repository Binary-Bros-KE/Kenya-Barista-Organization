# Applicant profiles, private CVs, and drafts

This phase adds `/dashboard/profile`, `/dashboard/applications`, and `/dashboard/applications/[id]`. Start a draft using the Apply button on an available public job. Sign in and verify your email first. If signing in takes you to your dashboard, return to the job and click Apply again.

Profiles contain full name, Kenyan mobile number in `+254` format, location, and a professional summary. Applicants can save an incomplete draft, attach one of their CVs, and resume later. The [payment phase](payments.md) now enforces profile completeness, clean CV screening, and payment confirmation before final submission.

Draft creation is idempotent per applicant/job. The fee and currency are copied from the job when the draft is first created and remain unchanged. Saves use an incrementing version; stale browser tabs receive a conflict. Closed or suspended jobs reject new drafts. Existing unpaid drafts remain accessible and editable, with an unavailable-job notice. Pending, paid, or unresolved payments lock the saved draft. Submitted applications cannot be edited through these routes.

## Private files

The initial storage adapter uses the VPS filesystem, outside the public directory. Development defaults to ignored `.private-uploads/`. For production set an absolute `PRIVATE_UPLOAD_DIR`, such as `/var/lib/barista/cvs`, outside every web server document root. Mount persistent storage there, restrict permissions to the application service, and back it up alongside PostgreSQL. This is a single-server adapter; use a shared private storage adapter before running web instances on separate servers. S3 integration is deferred.

PDF only, maximum 5 MiB, five stored CVs per account. Upload requests contain raw PDF bytes and an optional sanitized `X-Filename` header. The server bounds bytes while reading, screens PDF headers/trailers, generates an unpredictable storage key, and records a SHA-256 digest. This screening does not establish that a PDF is safe. Files remain `PENDING` until malware scanning completes.

The general document library download route remains owner-only. The [recruitment workflow](recruitment.md) separately permits authorised reviewers to download a clean, unchanged CV attached to a confirmed submission. It does not expose other documents. Downloads are attachments with private no-store headers. Rejected files cannot be downloaded or attached. CVs are immutable: upload a new one to replace a file. Remove attachments from drafts before deleting a CV. Attached records are protected against deletion by foreign keys.

## Malware scanning

Run a ClamAV daemon on a private interface with current signatures. Configure `CLAMAV_HOST` and `CLAMAV_PORT` (defaults `127.0.0.1:3310`). Run:

```powershell
npm.cmd run cvs:scan
```

The command processes up to 50 pending files per invocation using the [ClamAV INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html). Digest mismatches are rejected. Only an explicit complete clean response marks a file `CLEAN`; detected malware marks it `REJECTED`. Scanner errors stop the batch and leave unprocessed files pending for retry. Do not expose the daemon publicly. Scheduling and operational monitoring will be wired during VPS deployment. No ClamAV service is installed by this project, and no live scanner was available in development; protocol behavior is tested using a local test server.

## API

| Route | Purpose |
| --- | --- |
| `PUT /api/profile` | Save current user's profile |
| `POST /api/applications` | Start/resume using `{ slug }` |
| `PUT /api/applications/[id]` | Save `{ version, coverLetter, documentId }`; use null to detach |
| `POST /api/documents` | Upload raw `application/pdf` bytes |
| `GET /api/documents/[id]` | Owner-only attachment download |
| `DELETE /api/documents/[id]` | Remove an unused owned CV |

All routes require an active verified account. Mutations require the configured same origin. Ownership is checked in the database on every request. Lists are paginated and storage keys are not included in dashboard data.

## Regression suite

Start an isolated database with `npx.cmd prisma dev --name barista-application-tests --port 54213 --db-port 54214 --shadow-db-port 54215`. In another terminal:

```powershell
$env:DATABASE_URL='postgres://postgres:postgres@localhost:54214/template1?sslmode=disable'
npm.cmd run db:deploy
$env:AUTH_TEST_DATABASE_URL=$env:DATABASE_URL
$env:JOB_TEST_DATABASE_URL=$env:DATABASE_URL
$env:APPLICATION_TEST_DATABASE_URL=$env:DATABASE_URL
$env:RUN_DB_TESTS='true'
npm.cmd test
```

Run in a disposable terminal or clear these variables afterwards. Tests refuse the normal development database port. They use disposable users and private temporary directories, then clean up their own fixtures. CI is configured for the same suites against PostgreSQL 17.
