#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID == 0 ]] || { echo 'Run this one-time setup with sudo in your SSH terminal.' >&2; exit 1; }
base=/home/evans/barista-platform
repo=$base/repository
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ "$source_dir" == "$repo/deploy/automation" ]] || { echo 'Run the reviewed repository installer.' >&2; exit 1; }
[[ -L "$base/current" && -f "$base/shared/app.env" ]] || { echo 'An active staging deployment is required.' >&2; exit 1; }
[[ $(command -v systemctl) == /usr/bin/systemctl && -x /usr/bin/flock ]] || { echo 'Unexpected system tools.' >&2; exit 1; }
"$base/runtime/node/bin/node" --check "$source_dir/poll-deploy.mjs"
systemd-analyze verify "$source_dir/barista-staging-deploy.service" "$source_dir/barista-staging-deploy.timer"
rule=$(mktemp)
trap 'rm -f -- "$rule"' EXIT
printf '%s\n' 'evans ALL=(root) NOPASSWD: /usr/bin/systemctl restart barista-staging-web.service, /usr/bin/systemctl restart barista-staging-notifications.service' > "$rule"
visudo -cf "$rule"
if [[ -e /etc/sudoers.d/barista-staging-deploy ]] && ! cmp -s "$rule" /etc/sudoers.d/barista-staging-deploy; then
  echo 'A different deployment sudo policy exists; inspect it first.' >&2; exit 1
fi
for unit in barista-staging-deploy.service barista-staging-deploy.timer; do
  if [[ -e "/etc/systemd/system/$unit" ]] && ! cmp -s "$source_dir/$unit" "/etc/systemd/system/$unit"; then
    echo 'A different deployment unit exists; inspect before replacing it.' >&2; exit 1
  fi
done
install -o root -g root -m 440 "$rule" /etc/sudoers.d/barista-staging-deploy
for unit in barista-staging-deploy.service barista-staging-deploy.timer; do
  install -o root -g root -m 644 "$source_dir/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now barista-staging-deploy.timer
echo 'Automatic staging deployment enabled. Only two exact Barista restart commands are passwordless.'
echo 'No application restart, Nginx edit, database migration or other application change was performed by this installer.'
