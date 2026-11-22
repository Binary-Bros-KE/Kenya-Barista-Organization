# Changelog

The version shown in the workspace sidebar comes from `package.json`. To release a new version:

```powershell
npm.cmd version patch --no-git-tag-version   # 1.0.0 -> 1.0.1: fixes and small tweaks
npm.cmd version minor --no-git-tag-version   # 1.0.0 -> 1.1.0: new features
npm.cmd version major --no-git-tag-version   # 1.0.0 -> 2.0.0: big changes
```

Then add an entry below and restart the app.

## 2.10.0 - 2026-11-22

- Clicks never look ignored: a thin progress bar runs across the top of every page as soon as a link to another page is clicked, and the sidebar item being opened shows a small spinner until its page arrives.
- Loading screens: dashboard, admin and recruiter pages show a placeholder in the content area while the server prepares the page, with the sidebar and top bar staying in place.
- Admin and recruiter pages now share a layout (`app/admin/layout.tsx`, `app/employer/layout.tsx`) like the job-seeker dashboard, so the sidebar is drawn once instead of on every page. Each page still checks access itself.

## 2.9.2 - 2026-11-22

- My profile: the "How recruiters see you" preview now lines up with the top of the editor. It was offset 76px for a top bar that sits outside the scrolling area.

## 2.9.1 - 2026-11-22

- Removed the heading at the top of My profile; the page starts with the editor and preview.

## 2.9.0 - 2026-11-22

- **Create job posting** opens a popup with every job detail, the application fee and an optional cover photo (with preview), on the recruiter and admin job lists. **Save draft** creates the draft and opens it; **Submit for review** also submits it and shows a confirmation on the list.
- Recruiters set their own application fee when creating or editing a job. The platform default only pre-fills the field, and recruiters no longer need an admin to configure it first.
- Administrators can **Adjust fee** while a job waits for approval. The job stays in review and its history shows "Application fee changed from … to … by KBO". Fees still lock once an application has been started.
- Removed the heading at the top of Job postings.

## 2.8.0 - 2026-11-22

- View CVs in the page, without downloading. A **View CV** button on My profile and on a recruiter's applicant page opens a full-screen viewer built on pdf.js (`pdfjs-dist` 6.5.438): page-by-page scrolling, fit to width, zoom (buttons and + − 0 keys), a page counter, selectable text, and a Download button. It works on phones, where browsers can't show PDFs inside a page. pdf.js loads only when the viewer opens.
- The viewer uses the same permission-checked routes as downloads. A recruiter's view is logged as `application.cv_viewed`. Only page contents are drawn; PDF scripts, forms and links never run.

## 2.7.0 - 2026-11-22

- One CV per account (was five). Uploading a new CV replaces the current one: editable drafts switch to the new CV, while drafts whose payment has started and applications already sent keep the CV they had. The old CV is deleted unless something still uses it; then it's retired (hidden from its owner, no longer attachable, still downloadable by the recruiters it was sent to). The database allows only one current CV per account.
- Migration: accounts with several CVs keep their newest as the current one; the rest are retired.
- The CV panel on My profile shows "Your CV" with Upload CV, or Replace CV once there is one, and explains what happens to drafts and sent applications.
- Saving a draft from an out-of-date editor now says to reload before it checks the CV.

## 2.6.0 - 2026-11-22

- CVs can be stored in Cloudinary as private files (no public link; the server fetches them with a short-lived signed request). Set `CV_STORAGE=cloudinary`. Each CV records where its file is (`Document.storage`), so CVs already on disk keep working. Downloads still go through the app with the same permission, virus-scan and integrity checks. The file is uploaded before the database row is written, so a slow upload never holds a database lock, and it's removed again if the row can't be saved.
- Nightly database backups: `scripts/backup-database.mjs` runs `pg_dump`, stores the dump in Cloudinary as a private file and keeps the newest 14. It has `--list` and `--download` for restores. On the VPS it runs from the `evans` crontab at 02:30 Nairobi time. See docs/backups.md for checking and restoring.
- Photos, CVs and backups share one Cloudinary connection (`src/server/cloudinary.ts`). Tests always keep CVs on disk.

## 2.5.0 - 2026-11-22

- Image uploads with Cloudinary. The server checks each file really is a JPG, PNG or WebP, then uploads it with a signed request; the API secret never reaches the browser. Each account and job has one fixed image, so a new photo replaces the old one. Set `CLOUDINARY_URL` and `CLOUDINARY_FOLDER` (see docs/accounts.md); without them uploads are switched off and pages say so.
- My profile (was Profile and CVs): profile photo, headline, years of experience, up to 12 skills, an Open to work switch, Instagram, LinkedIn and website links, and a card colour, with a live preview of what recruiters see and a completeness checklist. CVs stay on the same page.
- Profile photos replace initials in the top bar (which now links to My profile), admin lists and popups, and the recruiter's view of an applicant. A recruiter's photo is the employer logo on their jobs.
- Job cover photos: added from the job editor once a draft is saved. Changing the cover of a published job sends it back for review. Job cards show the cover, or a branded cover coloured by category; job pages show a wide cover when there is a photo.
- Applicant pages for recruiters start with the candidate's current profile card; the submitted details below are unchanged.
- Job editor pages now use the shared workspace frame, so recruiters see their own menu and photo there.

## 2.4.6 - 2026-11-22

- Admin detail popups (Accounts, Recruiters, Requests): a compact header with the name on one line and the email and badges below it, beside a small avatar; the dot pattern now covers the whole header; corners are 16px.

## 2.4.5 - 2026-11-22

- Become a recruiter: an approved request whose recruiter access was later removed is now labelled "Reverted", in grey, instead of "Approved, later removed".

## 2.4.4 - 2026-11-21

- Fixed: after an administrator changed a recruiter back to a job seeker, Become a recruiter still said "You're a recruiter" because it went by the last approved request. It now goes by the account type, says "Your recruiter access was removed", offers Apply again while requests remain, and marks that request "Approved, later removed".

## 2.4.3 - 2026-11-21

- Admin Recruiters → Requests: removed the intro banner above the list. The Pending count and the empty "All caught up" message already say the same thing.

## 2.4.2 - 2026-11-21

- The rejection email is clear from the inbox: the subject is "Your KBO recruiter request was rejected", the inbox preview starts with the reason, and the heading reads "Your recruiter request was rejected".

## 2.4.1 - 2026-11-21

- Become a recruiter: the "used all requests" message is now a red warning. "Your past requests" is now "Your requests" and includes the latest request, tagged Latest. Job seekers with requests left see an "N attempts remaining" badge.

## 2.4.0 - 2026-11-21

- Each account can send at most 3 recruiter requests, withdrawn ones included. After the third, the page explains the limit and points to Contact KBO instead of showing the form; the server enforces it too (`REQUEST_LIMIT`).
- Become a recruiter now lists the job seeker's past requests with their dates, outcome and KBO's reason, and shows how many requests are left. Nothing was ever deleted: every request was already kept, but only the latest one was shown.

## 2.3.0 - 2026-11-21

- Rejected recruiter requests now get a branded email straight away, with the reason and an Apply again button. Before, the rejection only reached the inbox through the background notification worker, which isn't running locally.

## 2.2.2 - 2026-11-21

- The Withdraw request button on Become a recruiter is now a red signature button with a trash icon.

## 2.2.1 - 2026-11-15

- Signing in to an account whose email isn't verified now says "Email not verified, please check your email and verify to proceed."

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
