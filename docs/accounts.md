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

Sign in again, open `/dashboard/security`, and set up an authenticator app. Enter the displayed setup key manually as a time-based account, save the recovery codes privately, and verify a six-digit authenticator code. Then open `/admin`.

Administrator routes require both an active database role and second-factor proof for the current session. A session opened before authenticator enrollment does not gain that proof automatically. Subsequent sign-ins require a second factor. Recovery codes are single-use. Trusted-device bypass is disabled.

There is no public HTTP bootstrap endpoint or web endpoint for arbitrary administrator promotion. Further administrator lifecycle/recovery procedures should be designed before a production launch; do not delete the bootstrap marker to make extra administrators.

## Invite an employer

1. In `/admin`, create an organisation with a unique lowercase short name.
2. In Invitations, choose the active organisation, recipient email, and membership role.
3. The recipient registers or signs in using that exact email address and verifies it.
4. The recipient reopens the invitation email and selects Accept employer invitation.
5. Their organisations appear under `/employer`.

Invitation links expire after 48 hours, are consumed once, and contain a random token whose hash alone is stored in the database. The token is carried in the URL fragment, so it is not sent in page-request URLs or referrer headers. Reissuing an invitation revokes previous unused links for the same email and organisation. A database constraint also prevents concurrent duplicate unused invitations.

Only administrators can invite employers. Both owner and recruiter memberships are restricted to their organisation; neither grants platform administration. Job permissions will be implemented with job management in the next phase.

Administrators can revoke pending invitations, remove employer memberships, suspend organisations, and suspend non-administrator accounts. Account suspension revokes sessions. Organisation suspension and membership removal are checked on each protected organisation request. Administrator accounts cannot be suspended through this console.

## Password recovery and sign-out

- `/forgot-password` sends a reset link with a 30-minute lifetime and a generic response.
- `/reset-password` consumes the reset token and revokes all existing sessions.
- MFA remains required for an administrator after a password reset.
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

Production rejects development mailbox mode. Verification and password-reset mail is scheduled after the HTTP response to keep SMTP latency out of account-existence responses. Delivery failures emit a fixed event without addresses or tokens; the user can request another link. Durable delivery retries and the background worker remain part of the notifications phase. Administrator invitations report delivery failures and revoke the undelivered invitation.

On the VPS, expose the application only through its reverse proxy, overwrite incoming forwarded client-IP headers, rate-limit traffic at the proxy, and omit sensitive URL query strings from access logs. Do not trust client-supplied forwarding headers from an exposed Node port.

## Routes and permissions

| Route | Access |
| --- | --- |
| `/register`, `/sign-in`, recovery and verification screens | Public |
| `/dashboard`, `/dashboard/security` | Verified active account |
| `/admin` and `/api/admin/*` | Administrator with verified MFA session |
| `/employer` | Verified active account; lists its memberships only |
| `/employer/organisations/[id]` and matching API | Active membership in that active organisation |
| `POST /api/invitations/accept` | Verified invited email and valid unused invitation |

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
