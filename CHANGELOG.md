# Changelog

The version shown in the workspace sidebar comes from `package.json`. To release a new version:

```powershell
npm.cmd version patch --no-git-tag-version   # 1.0.0 -> 1.0.1: fixes and small tweaks
npm.cmd version minor --no-git-tag-version   # 1.0.0 -> 1.1.0: new features
npm.cmd version major --no-git-tag-version   # 1.0.0 -> 2.0.0: big changes
```

Then add an entry below and restart the app.


## 2.20.2 - 2026-11-23

- Website header dropdowns (Education, About us, Barista hub and the account menu) open one at a time: opening one closes the others, so they no longer stack on top of each other.

## 2.20.1 - 2026-11-23

- The website header knows when you're signed in. Instead of **My account** and **Sign in**, it shows your photo (or initials), first name and role (Member, Recruiter or Administrator). Clicking it opens a menu with your name and email, Dashboard, Jobs & applicants (recruiters) or Job review (administrators), My applications, Profile & CV, Notifications with your unread count, and Sign out. A small dot on the photo means you have unread notifications.
- The phone menu shows the same account links in place of My account and Sign in.
- Visitors who aren't signed in still see My account and Sign in. The header checks once per tab, so moving between pages doesn't flash the sign-in buttons.

## 2.19.0 - 2026-11-23

- Job and application emails now go out within seconds, instead of only when the background notification worker runs (which `npm run dev` doesn't start). After a job is submitted or published, or a payment is confirmed, the app sends the queued emails straight after replying; the worker still retries anything that fails.
- Branded emails, matching the recruiter request emails, for four moments:
  - **Recruiter submits a job for review**: "Your job is in review", with the job, location and deadline and what happens next. Admins still get "Job review requested".
  - **Admin approves and publishes a job**: the recruiter gets "Your job is live", with the public link to share.
  - **Job seeker's application is submitted** (fee confirmed): "Application received", with the job, recruiter and submission time.
  - **Someone applies to a recruiter's job**: "New applicant", with the applicant's name and the number of applicants so far.
- Dashboard notifications for these moments use the same wording and name the job, instead of the general "A job posting has an update".

## 2.19.0 - 2026-11-23

- Administrators post jobs as KBO itself: no more choosing a recruiter. The job belongs to the administrator account and appears to job seekers as **Kenya Barista Organization**, always with the Verified badge and ribbon (and in the public employer filter).
- The admin create popup offers **Publish now** (saved, submitted and approved in one step) or Save draft.
- Fixed the create popup squeezing the job title and description to a narrow column (toolbar label styles were leaking into the popup).

## 2.18.0 - 2026-11-23

- Recruiter and admin job cards are themed by status, so they are easy to tell apart at a glance: **Awaiting review** blue with a soft glow and a pulsing "Needs your review" tag (recruiters see "Waiting for KBO review"), **Published** green, **Draft** gold with a dashed edge, **Changes requested** orange with a "Sent back" tag, and **Closed / Archived** grey with a faded photo. The card edge, background tint, tags and button follow the status colour.

## 2.17.4 - 2026-11-23

- Job review: the default fee widget is a single line (input with a "Default fee (KES)" placeholder and Save), so the toolbar stays slim. A short "Saved" or error note appears on the same line.

## 2.17.3 - 2026-11-23

- Job review opens on **All statuses**. With no filter, jobs are ordered by what needs attention: awaiting review first, then live, then drafts, then returned (changes requested), closed and archived, newest first within each. This applies to the recruiter list too.
- The default application fee is now a small gold widget beside the status filter (amount and Save), instead of a separate panel.

## 2.17.2 - 2026-11-23

- Admin Job review: removed the "Opportunities worth opening." heading and the row of shortcut cards; the page opens with the default fee setting and the job list.

## 2.17.1 - 2026-11-23

- Manage posting popup: the decision bar is now a footer below the scrolling content instead of floating over it, so nothing hides behind the buttons. The recruiter card moved to the top of the right column, above the card preview, so it is always in view.

## 2.17.0 - 2026-11-23

- Manage posting popup redesigned in two columns like Profile & CV. Left: numbered sections for review and status, role details, cover photo and history. Right: a live preview of the job card exactly as applicants see it (updates as you type, with the Verified ribbon), plus the recruiter at a glance (photo, email, verified and account status).
- The cover now shows at card size beside its buttons instead of a stretched full-width image.
- Decision buttons sit in a bar pinned to the bottom of the popup, always visible: Approve and publish (green), Return with feedback (orange), Withdraw to draft, Close applications, Reopen, Archive, Save changes and Submit for review. The admin fee adjustment has its own gold button.

## 2.16.1 - 2026-11-23

- Member sidebar reorganised: **Overview** (Dashboard, formerly My account), **Your workspace** (Find jobs, Profile & CV, Applications, Payments, Notifications) and **Account** (Become a recruiter, Settings). The separate Explore section is gone for members; Find jobs leads Your workspace.
- "Security" is now called **Settings** everywhere (same page), including the dashboard shortcut.

## 2.16.0 - 2026-11-23

- Recruiter (Jobs & applicants) and admin (Job review) job cards now use the same design as Find jobs: cover photo, gold fee badge, a coloured status badge (Published, Awaiting review, Changes requested, Draft, Closed), category colour, employer, tags and deadline, with the applicants button and a coloured Manage posting / Review button.
- Verified recruiters: every job card (Find jobs, recruiter and admin lists, and the public jobs page) shows a green diagonal **Verified** ribbon across its top-left corner.

## 2.15.0 - 2026-11-23

- New **Find jobs** tab inside the workspace (the sidebar's Find jobs now opens it). Search by keyword, location, category and job type, or tap a coloured category chip. Each job card shows its cover, fee, employer, tags and deadline, plus "Draft saved" or your application status if you've already applied, or "N days left" when it closes soon.
- Clicking a job opens it in a popup with the full description, fee, deadline and job type. **Apply now** starts your application and opens it in the dashboard; no trip back to the website. Jobs you've applied to offer "Continue your application" or "View your application" instead.
- Applications: removed the big page heading and the Explore jobs button. The four summary cards are now coloured (like the dashboard) and filter the list when clicked; the status filters each have their own colour; the empty state's button leads to Find jobs.
- The dashboard's "Explore opportunities" and "Browse jobs" links now open Find jobs.

## 2.14.0 - 2026-11-23

- "My profile" is now **Profile & CV** in the sidebar, the page title, the avatar link and the dashboard shortcuts.
- Firmer, easier-to-see edges across the workspace: Profile & CV, Applications, Payments, Notifications, Security, Become a recruiter, recruiter job pages and popups, and the admin pages. Faint borders and dividers are darker, and the main cards have the same soft shadow as the dashboard.
- Profile & CV: the completion checklist shows solid green ticks instead of faint crossed-out text, form fields have clearer outlines, and the CV section is numbered 06 to follow the five sections above it.
- Recruiters no longer see Profile & CV twice in the sidebar.

## 2.13.1 - 2026-11-23

- Dashboard (My account): cards have firmer edges and a soft shadow so they stand out from the background. Account essentials shows completed steps as solid green ticks with a green progress bar; to-do steps, icons, dividers and labels are darker and easier to read.

## 2.13.0 - 2026-11-23

- My profile: your CV now shows as a card with a preview of its first page, a PDF label, the file size, the upload date and its screening status. Click the preview (or View CV) to read it in the page.
- The upload box only shows when you have no CV yet, or after you click **Replace CV** (with Cancel to close it again). Refresh status shows only while a CV is being screened.

## 2.12.0 - 2026-11-22

- Jobs and applicants are one tab for recruiters (**Jobs & applicants**). Each job card shows the newest applicants' photos, the number of applicants and how many are new; clicking it opens the applicants popup.
- Applicants popup: the list on the left (with All, New, In review, Shortlisted, Hired and Not selected filters) and the selected applicant on the right: their profile card, status, contact details, CV (view in page or download), cover letter, story, message history and the respond form. On phones the list and the applicant open one at a time, with a Back button.
- Administrators get the same popup on their job list and keep the separate Applicants page for all jobs. Applicant pages linked from emails and the dashboard still work and highlight Jobs & applicants.

## 2.11.1 - 2026-11-22

- Jobs awaiting review can now be edited from the manage popup (details, fee and cover) without withdrawing them first. Saving keeps the job in review, records "Edited while awaiting review" in its history, and an administrator who still has the older version open must reload before approving.

## 2.11.0 - 2026-11-22

- Job postings: **Manage posting** (and the job title) now opens the job in a popup over the list, with everything the job page had: details, cover photo, fee, submit or withdraw, and for admins approve, request changes and adjust the fee. The list refreshes when the popup closes.
- **Save draft** in the create popup opens the new draft in the manage popup instead of going to a separate page.

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
