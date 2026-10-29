# VPS inspection - 16 October 2026

Read-only SSH inspection of `evans@server.blueledgerpos.app` completed successfully using this device's existing authentication. No remote files, packages, database records, services, firewall rules, DNS or certificates were changed. No environment files, application credentials or database contents were read. PM2 output was restricted to safe process metadata.

## Observed environment

| Item | Observed state |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-137-generic |
| CPU | 8 logical processors |
| RAM | 23 GiB total, approximately 20 GiB available during inspection |
| Disk | 581 GiB root filesystem, 27 GiB used, 554 GiB available |
| Swap | None configured |
| Host timezone | Europe/Berlin; application deadlines continue to use explicit Africa/Nairobi handling |
| Node/npm | System Node 22.23.1, npm 10.9.8 |
| Web proxy | Nginx running on 80/443, multiple enabled virtual hosts |
| Process management | Existing `pm2-evans` system service and six online PM2 applications |
| Database | PostgreSQL 16.15, cluster `16/main`, loopback port 5432 |
| TLS | Certbot executable and renewal timer present |
| Monitoring | Netdata service present |
| Firewall | UFW configuration says enabled; effective rules were not inspected |
| CV scanning | ClamAV/clamav-daemon packages not present in the package query |
| Backups | `backups` and `db-backups` directories exist; schedules, backup contents and restore integrity were not verified |
| Privilege | SSH user belongs to sudo group; `sudo -n -l` requires a password |

Production apps currently include multi-tenant, Blue Ledger, Hotelier, Tanzania Hotelier, HCC SMS, and the Hotelier website. Existing listener allocations include 3100, 4000, 4100, 4200, 4300 and 5174. Nginx has an existing default/wildcard Hotelier site, so the Barista site needs its own exact hostname configuration. Existing application logs, secrets and databases were not inspected.

## Concrete staging proposal

1. Use an explicitly chosen staging hostname with DNS pointing to this VPS. Hostname is awaiting the owner's choice; main-domain DNS remains unchanged during staging.
2. Keep the project in a dedicated release/shared directory tree, proposed `/home/evans/barista-platform`. This path was not present during inspection. Private uploads, runtime secrets and encryption keys belong outside the public/build tree, with restrictive permissions.
3. Install an isolated Node 24 runtime and use its absolute executable path for this project's build and supervised processes. The project pins Node 24; production apps currently use system Node 22. Global Node replacement is unnecessary.
4. Use a dedicated Barista PostgreSQL database/login in the existing PostgreSQL instance. Production migration tests need to run against PostgreSQL 16 on staging; the previously configured PostgreSQL 17 CI is not proof of PostgreSQL 16 acceptance. Existing database definitions and data stay outside this project's migration scope.
5. Bind the new web process to `127.0.0.1:3200` (unoccupied during inspection), and proxy the selected exact staging hostname through a new Nginx virtual host with HTTPS. Validate Nginx configuration before a reload.
6. Run separately named/supervised web and notification processes. Prepare bounded schedules for payment reconciliation, CV scanning and job expiry, using the same application environment and isolated runtime. Scope process operations to the Barista processes.
7. Provision the ClamAV daemon, configure private CV storage, and verify file-permission/scanner access. Set real SMTP configuration and the public HTTPS Daraja callback only in private server-side configuration.
8. Configure and restore-test Barista database/private-upload backups, retain the payment encryption key in recovery material, and verify process restarts/health monitoring before accepting staging.

Privileged database provisioning, package/service installation, Nginx configuration and certificate operations require administrator execution. SSH authentication currently works, while noninteractive sudo does not. Prepare exact scripts/configuration for review; the owner can execute privileged steps in their own SSH terminal or provide appropriately scoped privilege through their normal server-administration process. Do not request or record a sudo password in chat or deployment files.

## Outstanding before deployment

- Staging hostname and DNS readiness.
- Privileged execution method for database/scanner/Nginx/TLS provisioning.
- SMTP settings and actual Daraja sandbox/merchant credentials entered through private configuration/admin settings.
- PostgreSQL 16 migration/native tests, end-to-end payment/email/scanner acceptance, backup restoration, browser/mobile acceptance and final dashboard styling.

This report verifies access and deployment capacity, not application readiness, production backup health, or externally effective firewall rules. No staging deployment has been performed.
