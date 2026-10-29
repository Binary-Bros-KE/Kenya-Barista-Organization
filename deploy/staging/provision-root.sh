#!/usr/bin/env bash
# Explicit sudo prerequisite step. Does not run app migrations or enable app workers.
set -euo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run this script with sudo from your SSH terminal.' >&2; exit 1; }
base=/home/evans/barista-platform
state=/var/lib/barista-staging-setup
[[ -d "$base/shared" && ! -L "$base" && ! -L "$base/shared" ]] || { echo 'Run prepare-user.sh first.' >&2; exit 1; }
password=$(cat "$base/shared/database-password")
[[ "$password" =~ ^[a-f0-9]{64}$ ]] || { echo 'Invalid private database password format.' >&2; exit 1; }
mkdir -p "$state"
chmod 700 "$state"
if [[ ! -f "$state/database-ready" ]]; then
  collision=$(runuser -u postgres -- psql -X -qAt -d postgres -c "SELECT count(*) FROM pg_roles WHERE rolname='barista_staging'; SELECT count(*) FROM pg_database WHERE datname IN ('barista_staging','barista_staging_test');")
  [[ "$collision" == $'0\n0' ]] || { echo 'Barista database/role already exists without this setup marker. Inspect manually; nothing was overwritten.' >&2; exit 1; }
  # Pipe the secret-bearing SQL through stdin; never put the password in argv/output.
  runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -d postgres <<SQL
CREATE ROLE barista_staging LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$password';
CREATE DATABASE barista_staging OWNER barista_staging;
CREATE DATABASE barista_staging_test OWNER barista_staging;
REVOKE ALL ON DATABASE barista_staging FROM PUBLIC;
REVOKE ALL ON DATABASE barista_staging_test FROM PUBLIC;
SQL
  touch "$state/database-ready"
fi
if [[ ! -f "$state/scanner-configured" ]]; then
  if dpkg-query -W -f='${Status}' clamav-daemon 2>/dev/null | grep -q 'install ok installed'; then
    echo 'An existing ClamAV installation needs manual inspection before changing its configuration.' >&2; exit 1
  fi
  if ss -lntH '( sport = :3310 )' | grep -q .; then echo 'Port 3310 is occupied. Inspect before continuing.' >&2; exit 1; fi
  apt-get update
  DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y --no-install-recommends clamav-daemon
  cp -a /etc/clamav/clamd.conf "$state/clamd.conf.before-barista"
  if grep -Eq '^[[:space:]]*(TCPSocket|TCPAddr)[[:space:]]' /etc/clamav/clamd.conf; then echo 'Unexpected existing TCP scanner configuration. Inspect manually.' >&2; exit 1; fi
  printf '\n# Barista staging: local INSTREAM clients only\nTCPSocket 3310\nTCPAddr 127.0.0.1\n' >> /etc/clamav/clamd.conf
  touch "$state/scanner-configured"
fi
systemctl enable --now clamav-freshclam.service
# Database download may still be running; report that condition without resetting it.
if find /var/lib/clamav -maxdepth 1 -type f \( -name 'daily.cvd' -o -name 'daily.cld' \) | grep -q .; then
  systemctl enable clamav-daemon.service
  systemctl restart clamav-daemon.service
else
  echo 'ClamAV signatures are not ready yet. Wait for freshclam, then rerun this script.'
fi
echo 'Dedicated staging/test databases provisioned. No existing database was migrated.'
echo 'Nginx, certificates, application processes and existing production processes were not changed by this script.'
