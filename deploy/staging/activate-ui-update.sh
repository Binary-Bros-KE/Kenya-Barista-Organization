#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo from your SSH terminal.' >&2; exit 1; }
base=/home/evans/barista-platform
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
[[ "$release" == "$base/releases/"* && -f "$release/.ui-verified.json" && -f "$release/.barista-built.json" ]] || { echo 'A built and verified UI release is required.' >&2; exit 1; }
previous=$(readlink -f "$base/current")
[[ "$previous" == "$base/releases/"* && "$previous" != "$release" ]] || { echo 'Unexpected current release; inspect before activating.' >&2; exit 1; }
expected=$("$base/runtime/node/bin/node" -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).source' "$release/.ui-release.json")
[[ "$previous" == "$expected" ]] || { echo 'Current release changed since this UI update was prepared. Inspect first.' >&2; exit 1; }
cd "$release"
runuser -u evans -- env -i HOME=/home/evans USER=evans PATH="$base/runtime/node/bin:/usr/bin:/bin" "$base/runtime/node/bin/node" deploy/staging/release.mjs select
if systemctl restart barista-staging-web.service; then
  for attempt in {1..25}; do
    if curl --fail --silent --max-time 3 http://127.0.0.1:3210/api/ready >/dev/null; then
      echo 'Website-branded account pages activated. Only the Barista web service was restarted.'
      exit 0
    fi
    sleep 1
  done
fi
echo 'New UI release did not become ready; restoring the previous release.' >&2
cd "$previous"
runuser -u evans -- env -i HOME=/home/evans USER=evans PATH="$base/runtime/node/bin:/usr/bin:/bin" "$base/runtime/node/bin/node" deploy/staging/release.mjs select
systemctl restart barista-staging-web.service
exit 1
