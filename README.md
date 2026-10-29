# Kenya Barista recruitment platform

Recruitment application with verified accounts, two-factor administrator access, employer invitations, job posting/review, public job discovery, private CVs, paid application submission, recruitment responses, notifications and payment administration. This repository contains only the barista-platform application, with app files at the repository root. Real merchant acceptance and production deployment remain before launch.

**Accounts setup and administrator instructions:** [docs/accounts.md](docs/accounts.md).

**Job posting, fees, review, and public listings:** [docs/jobs.md](docs/jobs.md).

## Requirements

- Node.js 24 LTS and npm.
- Git.
- For local development, the included Prisma 7 local database is sufficient. Docker and a system PostgreSQL installation are optional.
- Staging uses PostgreSQL 16 on the VPS; its full regression suite has been verified there.

On this Windows machine use `npm.cmd` and `npx.cmd`; PowerShell blocks the `.ps1` launchers. There is no need to change execution policy.

## Start the website

From PowerShell:

```powershell
cd C:\Users\Nyongesa\Downloads\cgi-bin\barista-platform
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run auth:setup
npm.cmd run db:generate
npm.cmd run dev
```

Copy `.env.example` only on initial setup; do not overwrite an existing configured `.env`. Visit http://localhost:3000. The foundation homepage works without a running database.

## Start PostgreSQL

### Included local database (no Docker required)

In a separate PowerShell terminal, from this project folder:

```powershell
npm.cmd run db:local
```

Leave it running while developing; press `q` to stop it. This starts a named, persistent local Prisma Postgres instance powered by PGlite. It does not create a Windows database service or a cloud account. Ports 51213–51216 are reserved for this local instance. Named-instance data is stored in Prisma's local application-data directory, outside Git. Do not remove that instance if you want to preserve development data.

In your application terminal:

```powershell
npm.cmd run db:deploy
$env:NODE_ENV = 'development'
$env:ALLOW_DEV_SEED = 'true'
npm.cmd run db:seed
Remove-Item Env:ALLOW_DEV_SEED
Remove-Item Env:NODE_ENV
```

The supplied `.env.example` matches this database. `SHADOW_DATABASE_URL` points to the separate local shadow database for future development migrations. Production and CI use standard PostgreSQL instead of this development server. See [Prisma's local development documentation](https://docs.prisma.io/docs/local-development/postgres).

### Docker alternative

Install and start [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/). Follow its Windows and WSL prerequisites; a system restart may be necessary. Change `DATABASE_URL` in `.env` to `postgresql://barista:local_development_only@127.0.0.1:5433/barista?schema=public` and remove `SHADOW_DATABASE_URL`. Then:

```powershell
docker compose up -d postgres
docker compose ps
npm.cmd run db:deploy
$env:NODE_ENV = 'development'
$env:ALLOW_DEV_SEED = 'true'
npm.cmd run db:seed
Remove-Item Env:ALLOW_DEV_SEED
Remove-Item Env:NODE_ENV
```

The Compose database is accessible only on `127.0.0.1:5433`, avoiding the usual 5432 port. Credentials in Compose and `.env.example` are deliberately local-only. Do not reuse this Compose configuration for production. Data persists in a Docker volume. `docker compose stop` stops the service without removing its data.

### Native PostgreSQL alternative

Use the [official Windows download page](https://www.postgresql.org/download/windows/) to install PostgreSQL 17. Create a dedicated non-superuser login and an empty database owned by that login. Set `DATABASE_URL` in `.env` to your credentials and port, then run `npm.cmd run db:deploy`. URL-encode special characters in passwords. Do not use a production database for local development.

## Database commands

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:migrate -- --name describe_change
npm.cmd run db:studio
```

`db:deploy` applies checked-in migrations and is appropriate for initial setup. `db:migrate` creates new migrations in development and can require a shadow database; grant only the local development role the necessary privileges or configure a separate shadow database. Never reset production data.

The guarded seed creates a demo organisation only. It requires a local host, `NODE_ENV=development`, and `ALLOW_DEV_SEED=true`. It does not create accounts, default passwords, fake applications, or payments.

## Verify

```powershell
npm.cmd run db:validate
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run start
```

- `/api/health` returns 200 when the web process responds.
- `/api/ready` returns 200 when PostgreSQL is reachable; otherwise a generic 503. It does not expose connection strings or SQL errors and does not certify that migrations are current.
- CI additionally starts PostgreSQL and applies migrations. CI is not proof of a successful local database setup.

To run the database constraint test locally after applying migrations, set `$env:RUN_DB_TESTS = 'true'`, run `npm.cmd test`, then `Remove-Item Env:RUN_DB_TESTS`. It only accepts a loopback database URL and rolls its fixtures back. Without that flag, the database test is explicitly skipped.

## Structure

```text
src/app/                 Public pages and HTTP routes
src/lib/                 Server environment, database, and logging helpers
src/generated/prisma/    Generated client (ignored; regenerated on install)
prisma/                  Schema, migrations, and guarded development seed
tests/                   Configuration regression checks
docs/architecture.md     Accepted rules, boundaries, and next phases
compose.yaml             Local PostgreSQL only
```

## Deployment later

The original public website appearance and all ten legacy public routes have been restored from the downloaded source maps, using the original images/fonts and content. Jobs and account access are integrated into its navigation. See [the public-site guide](docs/public-site.md) for the two missing guide illustrations, archived contact details that need client confirmation, and the email-draft boundary of the original course/contact forms. This is a restoration, with modernization kept outside the current scope.

Payment exception reviews are available at `/admin/payments/review`, including statement receipt confirmation, aged no-charge resolution, safe retries of original paid submissions, and private review history. See [the payment review guide](docs/payment-review.md). Money reversals remain manual outside the application; administrators record completed reversals on site.

Employers can review confirmed submissions, download submitted CVs, shortlist/hire/reject applicants, and send dashboard responses. Applicants can view responses and withdraw active submissions. See [the recruitment guide](docs/recruitment.md).

Dashboard notifications, email preferences, and background delivery with retries are implemented. Run `npm.cmd run notifications:run` for a batch or `npm.cmd run notifications:work` for a continuous worker. See [the notification guide](docs/notifications.md) for local previews, SMTP configuration, and the MFA-only delivery queue.

M-Pesa Paybill and Till configuration, encrypted credential storage, STK checkout, reconciliation, and payment-confirmed application submission are implemented. Start with [the payment guide](docs/payments.md). Real Daraja sandbox/live acceptance still requires merchant credentials and a reachable HTTPS callback.

Applicant profiles, private PDF CV uploads, and application drafts are available. See [the applicant guide](docs/applications.md) for routes, storage, scanning, and integration tests. Apply the latest migration with `npm.cmd run db:deploy` while the local database is running before trying the new pages.

Target: the owner's VPS, with Nginx/HTTPS, the web application, PostgreSQL on a private network, private object storage, and a background worker. Preserve existing VPS services and mail DNS. Production credentials, backup/restore verification, monitoring, migration rollout, and deployment packaging belong to the deployment phase.

Use [the accounts guide](docs/accounts.md) to register, verify email through the development mailbox, and bootstrap the initial administrator. Daraja credentials are not required yet. SMTP credentials are optional for local development and required outside it. Search indexing remains disabled until launch content is ready.

## Automatic staging updates

After the one-time VPS setup, push main and staging deploys after GitHub checks pass. See [automatic deployment](docs/automatic-deployment.md) for setup, status, retries and database change limits.
