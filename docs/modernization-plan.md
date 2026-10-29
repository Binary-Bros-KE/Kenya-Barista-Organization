# Modernization stages

The owner approved modernizing both the application and public website. Complete the dashboard first, then the website. Each stage is implemented, committed, pushed, checked in GitHub and verified after automatic staging deployment. Present the next stage for the owner's go-ahead before beginning it. Preserve the existing recruitment, access, payments and manual-reversal rules.

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Responsive coffee-themed sidebar, mobile drawer, logo and contextual header | Deployed |
| 2 | Dashboard overview: real role-aware summaries, recent work, account essentials and quick actions | Deployed |
| 3 | Profile and CVs: clear form sections, upload/screening states and document management | Deployed |
| 4 | Applicant applications, details, responses and withdrawal experience | Current stage |
| 5 | Applicant payments and notification inbox | Awaiting go-ahead |
| 6 | Security, authenticator setup and remaining account states | Awaiting go-ahead |
| 7 | Employer organisations, job editor/listings and applicant review | Awaiting go-ahead |
| 8 | Administration: accounts, organisations, job review, payment settings/review and delivery queue | Awaiting go-ahead |
| 9 | Public website design direction, homepage and shared navigation/footer | Awaiting go-ahead |
| 10 | Courses, about/philosophy, team, gallery, contact and coffee guides | Awaiting go-ahead |
| 11 | Public jobs/detail/application entry and authentication pages aligned to the new website | Awaiting go-ahead |
| 12 | Cross-device visual, keyboard and end-to-end journey polish | Awaiting go-ahead |

Use actual records and honest empty states. Platform summaries and review queues require administrator MFA. Personal account summaries and notifications must preserve ownership and existing visibility rules. Schema changes remain separately reviewed; these visual stages should not need them.

Stage 2 uses only read queries, reuses profile validation and notification audience filtering, and leaves all existing detail tabs/workflows in place. Charts with invented data and misleading “live” counters are excluded. Counts refresh on page navigation/reload. Mobile layouts use stacked panels and readable status rows.

Stage 4 preserves owner filtering on every application list/count query and existing detail/response access checks. Status filters retain pagination context. Draft editing retains version checks, screening eligibility and payment locks. Responses are rendered as text in Nairobi time. Withdrawal retains explicit confirmation and never initiates a payment reversal.
