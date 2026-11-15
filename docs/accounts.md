# Accounts and employer access

## Update this local checkout

Keep `npm.cmd run db:local` running in its own terminal. From another terminal in the project folder:

```powershell
npm.cmd install
npm.cmd run auth:setup
npm.cmd run db:deploy
npm.cmd run db:generate
npm.cmd run dev
```

`auth:setup` creates a random secret in ignored `.env` without printing it. It leaves an existing valid secret unchanged. Do not rotate an established secret casually: it protects sessions and encrypted authenticator data. Keep a protected backup with production secrets.

Restart an already-running application after updating dependencies, environment configuration, or the generated database client. Migrations add account tables and columns; they do not reset the foundation database.

## Register and verify a local account

1. Visit http://localhost:3000/register and register with your own email address and a unique passphrase of 12–128 characters.
2. Development mode uses `EMAIL_MODE=file`. Messages are written to ignored `.dev-mail/`, rather than sent externally.
3. Read your latest development emails using:

```powershell
npm.cmd run mail:preview -- --email you@example.com
```

4. Open the verification URL printed by that command, then sign in at `/sign-in`.

The mailbox command deliberately reveals the selected recipient's verification/reset links to the person running it locally. Do not share its output or commit the mailbox. There is no public mailbox-reading HTTP route.

## Create the initial administrator

After registering and verifying the intended account:

```powershell
npm.cmd run admin:bootstrap -- --email you@example.com
```

This command:

- Promotes an existing active, verified email/password account.
- Creates no default password and bypasses no email verification.
- Uses a unique database bootstrap marker to prevent a second initial setup.
- Revokes that account's existing sessions and records an audit event.

Sign in again and open `/admin`.

Administrator routes require an active, verified account with the administrator database role. Two-factor authentication is optional for every account, administrators included (a deliberate client decision, November 2026). An account that enables it at `/dashboard/security` is asked for a code on each sign-in. Recovery codes are single-use. Trusted-device bypass is disabled.

There is no public HTTP bootstrap endpoint or web endpoint for arbitrary administrator promotion. Further administrator lifecycle/recovery procedures should be designed before a production launch; do not delete the bootstrap marker to make extra administrators.

## Account types

Every account has one type:

| Type | What it can do |
| --- | --- |
| Job seeker | Build a profile, upload CVs and apply for jobs. Every new registration starts here. |
| Recruiter | Everything a job seeker can do, plus post jobs and review the people who apply to them. |
| Super admin | Run the platform: accounts, recruiters, job approvals, payments and the delivery queue. |

There are no companies or teams. A recruiter is an independent account, and each job belongs to the recruiter who posted it. Job listings show the recruiter's account name as the employer, so a business can name its recruiter account after itself.

### Becoming a recruiter

1. A job seeker opens **Become a recruiter** (`/dashboard/recruiter-request`) and says who they hire for, which roles, their phone, location and optionally a website or social page. One pending request is allowed at a time; they can withdraw it.
2. Administrators are notified, and the request appears under **Recruiters → Requests** (the sidebar shows how many are waiting).
3. The administrator approves it (the account becomes a recruiter straight away) or rejects it with a reason the person can read. Rejected people stay job seekers and can apply again.

### Verifying a recruiter

Open the recruiter on the Recruiters page and use **Verify this recruiter**. Email confirmation is checked automatically; the administrator confirms the phone number (by call or message) and the person's identity or business, optionally their online presence, adds a note, and marks them verified. Verified recruiters show a **Verified** badge on their job listings, job pages, dashboard and in admin lists. Verification can be removed, and it is cleared if the account is changed back to a job seeker.

Administrators can still switch an account's type directly from **Accounts → Account type**.

Changes apply immediately, including to someone who is signed in. A recruiter changed back to a job seeker keeps their jobs on record but can no longer manage them or see their applicants. Administrator accounts cannot be changed here, and only the bootstrap command creates the initial administrator.

Administrators can suspend and reactivate non-administrator accounts. Suspension signs the person out everywhere and, for a recruiter, hides their jobs from the public site.

## Password recovery and sign-out

- `/forgot-password` sends a reset link with a 30-minute lifetime and a generic response.
- `/reset-password` consumes the reset token and revokes all existing sessions.
- A password reset does not remove two-factor authentication from an account that enabled it.
- Sign-out invalidates the database session.
- An expired, suspended, or unverified account cannot use protected application routes.

## SMTP configuration

Before using accounts outside local development, configure `.env`:

```dotenv
EMAIL_MODE=smtp
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-provider-username
SMTP_PASSWORD=your-provider-password
SMTP_FROM=accounts@your-domain.example
APP_URL=https://your-domain.example
AUTH_SECRET=your-private-generated-secret
```

Use port 465 with `SMTP_SECURE=true` if required by the provider. With `SMTP_SECURE=false`, the sender requires STARTTLS. SMTP authentication must include both username and password or neither. Configure SPF, DKIM, and DMARC with the selected provider.

Production rejects development mailbox mode. Verification and password-reset mail is scheduled after the HTTP response to keep SMTP latency out of account-existence responses. Delivery failures emit a fixed event without addresses or tokens; the user can request another link. Durable delivery retries and the background worker remain part of the notifications phase.

On the VPS, expose the application only through its reverse proxy, overwrite incoming forwarded client-IP headers, rate-limit traffic at the proxy, and omit sensitive URL query strings from access logs. Do not trust client-supplied forwarding headers from an exposed Node port.

## Routes and permissions

| Route | Access |
| --- | --- |
| `/register`, `/sign-in`, recovery and verification screens | Public |
| `/dashboard`, `/dashboard/security` | Verified active account |
| `/admin` and `/api/admin/*` | Administrator |
| `/employer` | Verified active account; lists its memberships only |
| `POST /api/admin/memberships` | Administrator: add an existing account to a recruiter, or change its role |

Custom mutation APIs require the configured origin, and JSON bodies are limited to 16 KiB. Sensitive auth endpoints have persistent database-backed rate limits. Permission checks run on the server for pages and every API request; navigation visibility is not an authorisation boundary.

The administration console currently displays the latest 50 records in each section. Pagination/search belongs before larger-scale production use. Listing responses do not expose password hashes, invitation token hashes, authenticator secrets, recovery codes, or MFA timestamps.

## Tests

Normal `npm.cmd test` skips database integration tests unless explicitly enabled. To test accounts, use a separate disposable local database, never the normal port-51214 development database or a database with an existing administrator. For example, start:

```powershell
npx.cmd prisma dev --name barista-account-tests --port 52213 --db-port 52214 --shadow-db-port 52215
```

Then in a separate terminal:

```powershell
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:52214/template1?sslmode=disable'
npm.cmd run db:deploy
$env:AUTH_TEST_DATABASE_URL = $env:DATABASE_URL
$env:RUN_DB_TESTS = 'true'
npm.cmd test
Remove-Item Env:AUTH_TEST_DATABASE_URL
Remove-Item Env:RUN_DB_TESTS
Remove-Item Env:DATABASE_URL
```

The suite creates disposable accounts, captures mail in memory, exercises authentication and permissions, then removes its fixtures. It refuses remote databases and the normal development database port. CI is configured to run these tests against standard PostgreSQL 17; that hosted CI run is separate from local verification.
