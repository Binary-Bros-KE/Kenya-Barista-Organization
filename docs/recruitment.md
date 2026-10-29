# Recruitment review and applicant responses

Employers and MFA-verified platform administrators can review applications at `/employer/applications`. The Review applicants navigation link and the applicant count on each managed job lead to this workflow. Administrators see all organisations; employers see only their current active memberships. OWNER and RECRUITER memberships both permit recruitment actions in that organisation.

Only applications with a submitted timestamp, a non-draft status, and a confirmed paid payment order appear. An existing confirmed payment later recorded as refunded retains its historical recruitment record. Drafts, unpaid applications, and paid-but-unsubmitted applications are excluded from employer lists, job filters, details, responses, CV endpoints, and managed-job applicant counts.

## Review an application

The list supports job, status, and job-title/applicant-email search, with 20 applications per page. The job selector lists the latest 200 jobs with confirmed submissions in the viewer's scope. Search and direct job filters still work beyond those selector options. Job closure, deadline expiry, or archiving does not prevent reviewing applications already submitted.

An application detail shows the profile, contact details, summary, cover letter, and job terms captured at submission. Later profile edits do not replace this snapshot. Incomplete snapshots or inconsistent payment amounts/currency require administrator review instead of exposing a partial submission.

The submitted CV is available through a separate application-scoped download endpoint. Reviewers never receive general access to the applicant's document library. Downloads require the original attachment, its original SHA-256 digest, and current CLEAN scanning status. The server verifies stored file bytes and size before returning an attachment with private no-store headers. Successful downloads are audited. CV access is denied after withdrawal.

## Status changes and messages

| Current status | Allowed decisions |
| --- | --- |
| Submitted | Under review, Shortlisted, Not selected |
| Under review | Shortlisted, Not selected |
| Shortlisted | Hired, Not selected |
| Hired / Not selected | No further status changes; follow-up messages remain available |
| Withdrawn | No further decisions, messages, or CV downloads |

Every response requires an applicant-visible message, maximum 4,000 characters. Reviewers can also send a response without changing status. There are no private/internal notes in this composer. Messages are plain text and rendered escaped; HTML is not executed. Applicants see the organisation or KBO administration label, rather than the reviewer's private email or account ID.

Actions require the application version displayed on the page. A stale tab or competing reviewer cannot overwrite a newer decision. Changing status also records application status history. Each response records its author and sender label, writes an audit event, and creates a deduplicated `application.response` outbox event. Responses are immutable through the API. Repeated stale POSTs do not send additional messages.

Employers lose access when their membership is removed or the organisation is suspended. Administrators require current-session MFA and can read historical records for suspended organisations, but cannot send recruitment responses until the organisation is reactivated. Terminal decisions cannot be reversed through the current administrator interface either.

## Applicant view and withdrawal

Applicants see response counts on `/dashboard/applications` and the response timeline on `/dashboard/applications/[id]`. Both reviewer and applicant timelines show 20 entries per page, newest first. An applicant can access only their own timeline; other users receive not found.

Applicants may withdraw a Submitted, Under review, or Shortlisted application using the explicit confirmation form. A reason is optional, up to 2,000 characters. Withdrawal is final in this interface, records a response and status history, and queues `application.withdrawn` for the future notification worker. The application and payment records remain intact; withdrawal does not automatically refund the fee. Hired or rejected applications cannot be withdrawn through this flow. New payments or reapplications for the same job are not enabled after withdrawal.

If withdrawal races with a recruiter decision, version checks permit only one action to commit. The other caller must reload the latest status before continuing. Downloaded copies cannot be recalled; withdrawal prevents subsequent CV download requests through this application.

## Routes

| Route | Access |
| --- | --- |
| `GET /api/employer/applications` | Organisation reviewer or MFA administrator; scoped filters and pagination |
| `GET /api/employer/applications/[id]` | Scoped submitted profile and CV availability |
| `GET /api/employer/applications/[id]/cv` | Scoped, clean, unchanged submitted CV only |
| `GET /api/employer/applications/[id]/responses?page=1` | Scoped response timeline |
| `POST /api/employer/applications/[id]/responses` | `{ version, message, status? }`; scoped reviewer |
| `GET /api/applications/[id]/responses?page=1` | Application owner only |
| `POST /api/applications/[id]/withdraw` | `{ version, reason? }`; application owner only |

All account mutations require the configured same origin, an active verified account, and server-side role/ownership checks. APIs reject arbitrary author IDs, payment flags, timestamps, or other unsupported fields.

## Run and verify

With the normal development database running, apply the migration and regenerate the client:

```powershell
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run dev
```

The migration adds response records without rewriting existing accounts, applications, or payment data. Existing confirmed submissions can be reviewed immediately if their submission snapshots are complete. No demo paid applications are seeded into the normal database.

For isolated integration tests, start:

```powershell
npx.cmd prisma dev --name barista-recruitment-tests --port 56213 --db-port 56214 --shadow-db-port 56215
```

In a disposable terminal, point DATABASE_URL and RECRUITMENT_TEST_DATABASE_URL to `postgres://postgres:postgres@localhost:56214/template1?sslmode=disable`, apply migrations, set RUN_DB_TESTS=true, and run `npx.cmd tsx --test --test-concurrency=1 tests/recruitment.test.ts`. For the complete suite, set the AUTH, JOB, APPLICATION, PAYMENT, and RECRUITMENT test database URLs to the same isolated database before `npm test`. Local payment/recruitment tests default to one connection for the embedded database; native PostgreSQL CI sets TEST_DATABASE_POOL_MAX=5. Test fixtures create confirmed payment records directly only in the isolated test database; they never call Daraja or charge money.

## Next phase

Responses are visible in the dashboard immediately. The [notification worker](notifications.md) now expands their transactional outbox events into inbox alerts and background email with delivery retries. Interviews can be arranged through free-text responses; calendar scheduling, private recruiter notes, two-way chat, bulk decisions, and reversing terminal decisions are not part of this phase. Real merchant acceptance, ClamAV/SMTP configuration, payment review/refunds, browser/mobile acceptance, and VPS deployment remain launch work.
