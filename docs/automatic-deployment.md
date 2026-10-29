# Automatic staging deployment

Repository: https://github.com/Binary-Bros-KE/Kenya-Barista-Organization

Staging: https://barista-staging.tanzhotelms.com

## Routine updates

Commit application changes and push `main`. The **Staging checks** GitHub workflow installs locked dependencies on Node 24, applies migrations only to its disposable PostgreSQL 16 database, runs the full database regression suite and deployment policy tests, then builds production assets. Pull requests run the same checks but cannot trigger staging deployment.

After the one-time VPS installation, a systemd timer checks `main` approximately every two minutes after the preceding run finishes. It deploys only the exact commit with a successful latest push/manual workflow run. It uses the public repository and GitHub API; no GitHub token, deployment SSH key or application credentials are stored in GitHub Actions. Making the repository private requires a reviewed authentication change.

The VPS creates an isolated release, installs dependencies, builds with its private staging environment and checks a temporary loopback preview. The current website keeps running during this work. An outdated build is not activated if `main` advanced meanwhile. Switching releases briefly restarts only the Barista web and notification services. Failed startup/readiness restores the previous application release. Scheduled payment/CV/expiry jobs keep their existing leases and unit definitions; subsequent runs resolve the new current release.

## One-time VPS setup

The installer has been syntax-checked, and the deployment policies/rollback tests run without changing live services. Review these files in `deploy/automation`:

- `install-root.sh`: installs only the new deployment service/timer and its dedicated sudo policy.
- `barista-staging-deploy.service`: runs as evans, with a deployment lock and resource limits.
- `barista-staging-deploy.timer`: polls every two minutes.
- `poll-deploy.mjs` and `policy.mjs`: exact-commit CI gate, private build, preview, activation and rollback.

Run once in the owner's SSH terminal:

```bash
sudo bash /home/evans/barista-platform/repository/deploy/automation/install-root.sh
```

The sudo policy permits **only** these exact commands without a password:

```text
/usr/bin/systemctl restart barista-staging-web.service
/usr/bin/systemctl restart barista-staging-notifications.service
```

It grants no arbitrary shell, service, file-edit or database privileges. The installer changes no Nginx, existing PM2 application, database schema, system Node version or payment configuration. Staging still shares the evans Unix account with other applications; the deployment process has that account's existing access, not a separate security principal. The service explicitly permits scoped sudo; enabling NoNewPrivileges would prevent these restarts.

## Database changes

Routine automatic deployments require the schema and migration files to match the active release. Any change to those files stops deployment **before installation, application restart or database mutation** and records the reason. GitHub CI can still test new migrations in its disposable database. Review database backups, compatibility and migrations separately, deploy that reviewed schema change, then let normal automatic updates resume. Code rollback does not undo schema changes or application data. The automation never seeds, resets or migrates the staging database.

## Status and retries

```bash
systemctl status barista-staging-deploy.timer
systemctl status barista-staging-deploy.service
journalctl -u barista-staging-deploy.service -n 100
cat /home/evans/barista-platform/shared/deployment-status.json
```

Build output is private in the attempted release's `.deploy-build.log`. A failed commit/workflow attempt is not rebuilt every two minutes. Push a fix, run the workflow again using **Run workflow**, or explicitly retry a successful checked commit:

```bash
/usr/bin/flock -n -E 0 /home/evans/barista-platform/shared/deploy.lock \
  /home/evans/barista-platform/runtime/node/bin/node \
  /home/evans/barista-platform/repository/deploy/automation/poll-deploy.mjs --retry
```

`--retry` never bypasses CI or schema guards. To check the next commit without building, selecting a release or restarting anything:

```bash
/home/evans/barista-platform/runtime/node/bin/node \
  /home/evans/barista-platform/repository/deploy/automation/poll-deploy.mjs --check
```

Repository checkout `/home/evans/barista-platform/repository` keeps the installed automation version. Normal deployments fetch source commits without replacing that working tree. Changes to deployment infrastructure itself require a deliberate review/update of that checkout; root-owned unit/policy changes require the installer again. Application changes do not.

Old and failed releases are retained for inspection and rollback; review retention as disk usage grows. Do not delete the current release, previous release or shared private data.

References: [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).
