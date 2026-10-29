#!/usr/bin/env bash
set -euo pipefail
base=/home/evans/barista-platform
release=$(readlink -f "$base/current")
[[ "$release" == "$base/releases/"* && -d "$release" ]] || { echo 'No valid Barista release selected.' >&2; exit 1; }
node="$base/runtime/node/bin/node"
cd "$release"
command=${1:-}
case "$command" in
  web) args=("$release/node_modules/next/dist/bin/next" start --hostname 127.0.0.1 --port 3210) ;;
  notifications) args=("$release/node_modules/tsx/dist/cli.mjs" scripts/notification-worker.ts --watch) ;;
  payments) args=("$release/node_modules/tsx/dist/cli.mjs" scripts/reconcile-payments.ts) ;;
  cvs) args=("$release/node_modules/tsx/dist/cli.mjs" scripts/scan-cvs.ts) ;;
  expiry) args=("$release/node_modules/tsx/dist/cli.mjs" scripts/close-expired-jobs.ts) ;;
  *) echo 'Choose web, notifications, payments, cvs or expiry.' >&2; exit 1 ;;
esac
# Do not inherit another application's environment, even if launched from its shell.
exec env -i HOME=/home/evans USER=evans PATH="$base/runtime/node/bin:/usr/bin:/bin" TZ=Africa/Nairobi \
  "$node" --env-file="$base/shared/app.env" "${args[@]}"
