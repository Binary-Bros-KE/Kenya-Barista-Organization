#!/usr/bin/env bash
# Nightly KBO database backup to Cloudinary (private files, newest 14 kept). Runs from the evans crontab;
# see docs/backups.md. Extra arguments pass through, e.g. --list or --download NAME.
set -euo pipefail
base=/home/evans/barista-platform
mkdir -p "$base/shared/logs"
# One run at a time; the app's own environment only, never the caller's shell.
exec /usr/bin/flock -n "$base/shared/backup.lock" env -i HOME=/home/evans USER=evans PATH="$base/runtime/node/bin:/usr/bin:/bin" TZ=Africa/Nairobi \
  "$base/runtime/node/bin/node" --env-file="$base/shared/app.env" "$base/shared/bin/backup-database.mjs" "$@"
