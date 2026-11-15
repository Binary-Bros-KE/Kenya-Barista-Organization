# Changelog

The version shown in the workspace sidebar comes from `package.json`. To release a new version:

```powershell
npm.cmd version patch --no-git-tag-version   # 1.0.0 -> 1.0.1: fixes and small tweaks
npm.cmd version minor --no-git-tag-version   # 1.0.0 -> 1.1.0: new features
npm.cmd version major --no-git-tag-version   # 1.0.0 -> 2.0.0: big changes
```

Then add an entry below and restart the app.

## 2.2.0 - 2026-11-15

- Branded emails (HTML with a plain-text version) for recruiters: request received and awaiting approval, request approved, and verification complete. Each is sent straight away and marked as sent on its dashboard notification; if sending fails, the notification worker retries it.
- Mail messages can now include HTML (`html` on `MailMessage`). Templates live in `src/server/email-templates.ts`.

## 2.1.0 - 2026-11-15

- Job seekers request to become recruiters from their dashboard (Become a recruiter). Administrators review requests under Recruiters → Requests, with a count in the sidebar, and approve (the account becomes a recruiter) or reject with a reason. Both sides are notified.
- Recruiter verification: administrators confirm phone and identity or business (email is checked automatically) and mark recruiters verified. Verified recruiters show a Verified badge on job listings, job pages, their dashboard and admin lists; unverified recruiters see "Verification pending".
- Recruiters page: Verified/Unverified filters and a Pending requests card. The "add recruiter by email" box is removed.
- Migrations `20261115120000_recruiter_requests` (request table, one pending request per person, verification fields) and `20261115120100_account_notifications` (personal account notices).

## 2.0.0 - 2026-11-15

Companies are removed. There are three account types: **Job seeker**, **Recruiter** and **Super admin**.

- Recruiters are independent accounts. Each job belongs to the recruiter who posted it, and listings show the recruiter's account name as the employer.
- Administrators switch accounts between job seeker and recruiter: Accounts → open a person → Account type, or Recruiters → Add recruiter (by email). Changing a recruiter back to a job seeker removes their access to their jobs and applicants immediately.
- The Recruiters page lists recruiter accounts with their jobs, applications and sign-in activity; actions are suspend, reactivate and change to job seeker.
- Suspending a recruiter's account hides their jobs from the site (replaces company suspension).
- Removed: companies, company teams, `/employer/organisations`, `/api/admin/organisations`, `/api/admin/memberships`, `/api/employer/organisations`. New: `POST /api/admin/account-type`, `GET /api/admin/recruiters/[id]`.
- Migrations `20261115100000_recruiter_role` and `20261115100100_remove_companies`: team members become recruiters; each job moves to its creator if they were on the team, otherwise the company's first owner, then first member, then the creator, then the first admin; live jobs of suspended companies are closed; company tables are dropped.
- Security: job list filters can no longer widen a recruiter's view beyond their own jobs.

## 1.4.0 - 2026-11-15

- Employer invitations are removed. Administrators now give an existing account recruiter access directly, effective immediately: from a recruiter (Add a team member, by account email) or from an account (Recruiter access → Make recruiter). Access is removed the same way.
- Removed: invitation emails and links, the accept page, `/api/invitations/accept` and `/api/admin/invitations`. New: `POST /api/admin/memberships`.
- The old `EmployerInvitation` table is left in the database untouched and unused.

## 1.3.0 - 2026-11-15

- Recruiters get their own dashboard: Live jobs, New applicants, Awaiting approval and Changes requested cards, the latest applicants, and jobs needing attention (drafts, with KBO, or sent back).
- Recruiter sidebar: Recruiting (Review applicants, Job postings, Your companies) plus their job-seeker tabs and account tabs. Job seekers without recruiter access no longer see employer tabs.
- Accounts and Recruiters use compact, half-height stat cards; the dashboard keeps full-size cards.
- Slimmer top bar (60px), with the sidebar header aligned to it.

## 1.2.0 - 2026-11-15

- Organisations is now **Recruiters** (`/admin`): stat cards, at-a-glance insights, search by company, short name or team member, status filters (including "No team yet"), sorting, and a detail view per recruiter with team, invitations, jobs and history.
- Recruiter actions in one place: add a recruiter and invite their first team member in one step, invite or remove team members, cancel invitations, suspend or reactivate.
- Recent administrator activity sits at the bottom of the Recruiters page.
- Accounts pop-up opens instantly, prefetches on hover and remembers accounts already opened.

## 1.1.0 - 2026-11-14

- New **Accounts** page for administrators (`/admin/accounts`): stat cards, at-a-glance insights, search by name, email, phone or location, filters for status, account type and last sign-in, sorting, and a detail view per account with profile, CVs, applications, employer access, sign-in activity and history, plus suspend and reactivate.
- Accounts now record their last sign-in time (database migration `20261114120000_account_last_sign_in`).
- Sign-in, registration and password reset forms have a show/hide password button.
- The Organisations page no longer has its own accounts tab.

## 1.0.0 - 2026-11-14

First tracked version.

- Public website: Education pages (online courses, barista academies, coaching), Barista hub renames, page banners, full-width home hero with "Find a coffee job" as the main action, floating contact button.
- Workspace: administrators get an admin-only sidebar and a dashboard that opens with stat cards; signature button style; app version in the sidebar.
- Accounts: two-factor authentication is optional for every account, administrators included.
