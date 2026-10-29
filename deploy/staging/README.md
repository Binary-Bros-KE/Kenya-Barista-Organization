# Staging: barista-staging.tanzhotelms.com

These files target the inspected Ubuntu VPS, user `evans`, and only `/home/evans/barista-platform`. Production PM2 applications keep their current Node 22 runtime and process configuration. Barista uses a private Node 24 runtime, new systemd unit names, port 3210 on loopback, and dedicated PostgreSQL databases.

## Prerequisites and ordered execution

1. Add DNS **A** record `barista-staging` → `169.58.82.15` in the authoritative `tanzhotelms.com` DNS zone. Inspect any existing AAAA record as well; it must reach this same VPS before requesting TLS. Main-domain DNS is unchanged.
2. Upload a source-only release into `releases/<release-id>` and run `prepare-user.sh` as **evans**. It generates server-only secrets once, without printing them, and installs an isolated Node 24 distribution verified against the official HTTPS checksum list. It does not change system Node or start the app. Do not copy the Windows development `.env`, private CVs or development database.
3. From your own SSH terminal, review and run `sudo bash deploy/staging/provision-root.sh` in the release directory. This creates **barista_staging** and **barista_staging_test** with a dedicated non-superuser login and configures a newly installed ClamAV daemon on `127.0.0.1:3310`. Existing database/role collisions stop setup. An already-installed scanner without our marker also stops setup instead of overwriting its configuration. Apt refreshes package metadata and installs scanner packages; it does not upgrade the existing application stack. Wait for signature download before scanner acceptance. The root script may need a rerun once signatures exist; partial database/package failures require inspection instead of destructive resets.
4. Enter SMTP settings directly in `/home/evans/barista-platform/shared/app.env`, e.g. using `nano`. Use normal dotenv quoting for values with spaces/special characters. Keep the generated auth/payment/database secrets unchanged and the file mode at 600. Do not paste secrets in chat. Real SMTP is mandatory before selecting/starting the production-mode release; file-mail mode is deliberately unavailable on a public hostname.
5. As evans in the release directory, run:

   ```bash
   /home/evans/barista-platform/runtime/node/bin/node deploy/staging/release.mjs build
   ```

   This keeps build/worker tooling installed, applies migrations **only to the dedicated staging database**, and builds the Linux production bundle. It neither selects the release nor starts services. Back up this database before future schema upgrades. A current-release symlink is not a database rollback mechanism.
6. Review/run `sudo bash deploy/staging/install-http-root.sh`. This adds only the exact staging hostname, ACME challenge webroot and a maintenance response. It tests Nginx before reload; no existing virtual-host file is edited. After DNS resolves here, request the certificate interactively:

   ```bash
   sudo certbot certonly --webroot -w /var/www/barista-staging-acme -d barista-staging.tanzhotelms.com
   ```

   Enter the owner's certificate contact email and review Certbot's prompts in that terminal. No existing certificate is replaced.
7. As evans, select the built/configured release:

   ```bash
   /home/evans/barista-platform/runtime/node/bin/node deploy/staging/release.mjs select
   sudo bash deploy/staging/activate-root.sh
   ```

   Selection checks SMTP/configuration and atomically updates only this application's `current` symlink. Activation adds separately named systemd units, verifies local readiness, enables the HTTPS proxy, then enables the notification worker and bounded payment/CV/expiry timers. It does not operate the existing PM2 processes. Initial activation intentionally stops on existing Barista unit files/occupied app port; subsequent upgrades need a deliberate release/rollback procedure.

## Service operations

```bash
systemctl status barista-staging-web barista-staging-notifications
systemctl list-timers 'barista-staging-*'
journalctl -u barista-staging-web -n 100
journalctl -u barista-staging-job@cvs -n 100
curl --fail https://barista-staging.tanzhotelms.com/api/health
curl --fail https://barista-staging.tanzhotelms.com/api/ready
```

Services run as evans with a clean, explicitly loaded environment and an isolated runtime; existing PM2 environment values are not inherited. They have restrictive creation permissions and filesystem hardening. This is application/process separation on the shared host, not a separate Unix security principal or container. Private application data is in `shared`; it is not served by Nginx or Next static assets. Keep the app base readable only to the deployment account.

Timers run bounded jobs approximately once per minute after each preceding run completes. PostgreSQL leases/CAS safeguards remain active. Logs go to journald; production retention/monitoring and alert routing still require acceptance.

## Required acceptance before main-domain cutover

- Native PostgreSQL **16** migration/regression tests against `barista_staging_test`, never the real staging/production application database. Use explicit isolated test URLs and fixture cleanup; no database reset command is included here.
- Real SMTP verification/reset/invitation and worker delivery to an explicitly chosen test recipient.
- Real ClamAV clean/infected test protocol results and CV upload/download permission checks.
- Actual onboarded Daraja sandbox/live acceptance, HTTPS callbacks and scheduled reconciliation. No reversal API is used; monetary returns remain manual.
- Applicant/employer/admin journeys, role isolation, browser/mobile acceptance and dashboard styling alignment.
- Encrypted off-host database/private-upload/key backups, restore test, service restart/reboot checks, and operational monitoring.

The files are deployment preparation, not evidence that these server actions or acceptance checks have run. Never reset/recreate an existing database to make a failed step pass. Do not rotate the payment encryption key without a migration/recovery plan.

References: [Node official downloads](https://nodejs.org/en/download), [ClamAV scanning/socket documentation](https://docs.clamav.net/manual/Usage/Scanning.html).
