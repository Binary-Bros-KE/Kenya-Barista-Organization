#!/usr/bin/env bash
# Runs as evans. Only creates this application's own directory/runtime/config.
set -euo pipefail
umask 077
[[ $(id -un) == evans ]] || { echo 'Run as evans, without sudo.' >&2; exit 1; }
base=/home/evans/barista-platform
[[ ! -L "$base" ]] || { echo 'Application base must not be a symlink.' >&2; exit 1; }
mkdir -p "$base"/{incoming,releases,shared/cvs,shared/logs,shared/backups,runtime}
chmod 700 "$base/shared" "$base/shared/cvs" "$base/shared/backups"
if [[ ! -x "$base/runtime/node/bin/node" ]]; then
  case $(uname -m) in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;; esac
  download=$(mktemp -d "$base/runtime/download.XXXXXX")
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$download/SHASUMS256.txt"
  archive=$(awk -v arch="$arch" '$2 ~ "^node-v24\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.xz$" { print $2 }' "$download/SHASUMS256.txt")
  [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { echo 'Could not identify official Node 24 archive.' >&2; exit 1; }
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/latest-v24.x/$archive" -o "$download/$archive"
  (cd "$download"; grep "  $archive$" SHASUMS256.txt | sha256sum --check --status)
  tar -xJf "$download/$archive" -C "$base/runtime" --no-same-owner
  ln -s "${archive%.tar.xz}" "$base/runtime/node"
fi
export PATH="$base/runtime/node/bin:$PATH"
[[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || { echo 'Isolated Node 24 runtime required.' >&2; exit 1; }
if [[ ! -e "$base/shared/app.env" ]]; then
  db_password=$(openssl rand -hex 32)
  printf '%s\n' "$db_password" > "$base/shared/database-password"
  cat > "$base/shared/app.env" <<EOF
NODE_ENV=production
APP_URL=https://barista-staging.tanzhotelms.com
DATABASE_URL=postgresql://barista_staging:${db_password}@127.0.0.1:5432/barista_staging
DATABASE_POOL_MAX=5
AUTH_SECRET=$(openssl rand -hex 32)
PAYMENT_ENCRYPTION_KEY=$(openssl rand -hex 32)
PAYMENT_CALLBACK_BASE_URL=https://barista-staging.tanzhotelms.com
PRIVATE_UPLOAD_DIR=/home/evans/barista-platform/shared/cvs
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
LOG_LEVEL=info
EMAIL_MODE=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EOF
  chmod 600 "$base/shared/app.env" "$base/shared/database-password"
fi
echo "Isolated runtime ready: $(node --version). Private configuration is in $base/shared/app.env."
echo 'SMTP fields still need private configuration. No application process has been started.'
