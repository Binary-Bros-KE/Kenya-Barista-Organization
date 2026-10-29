#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
base=/home/evans/barista-platform
release=$(readlink -f "$base/current")
[[ "$release" == "$base/releases/"* && -f "$release/.barista-built.json" ]] || { echo 'Select a built release first.' >&2; exit 1; }
cd "$release"
runuser -u evans -- env -i HOME=/home/evans USER=evans PATH="$base/runtime/node/bin:/usr/bin:/bin" "$base/runtime/node/bin/node" deploy/staging/release.mjs check
cert=/etc/letsencrypt/live/barista-staging.tanzhotelms.com
[[ -s "$cert/fullchain.pem" && -s "$cert/privkey.pem" ]] || { echo 'Issue the staging certificate first.' >&2; exit 1; }
target=/etc/nginx/sites-available/barista-staging
[[ -L /etc/nginx/sites-enabled/barista-staging && $(readlink /etc/nginx/sites-enabled/barista-staging) == "$target" ]] || { echo 'Install the separate HTTP staging virtual host first.' >&2; exit 1; }
if ss -lntH '( sport = :3210 )' | grep -q .; then echo 'Port 3210 is occupied; inspect before activating.' >&2; exit 1; fi
for unit in barista-staging-web.service barista-staging-notifications.service barista-staging-job@.service barista-staging-job@.timer; do
  [[ ! -e "/etc/systemd/system/$unit" ]] || { echo 'Barista service files already exist. Use an explicit release upgrade procedure.' >&2; exit 1; }
done
nginx -t
for unit in barista-staging-web.service barista-staging-notifications.service barista-staging-job@.service barista-staging-job@.timer; do
  install -m 644 "$release/deploy/staging/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl start barista-staging-web.service
ready=false
for attempt in {1..20}; do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3210/api/ready >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'New web process is not ready. Inspect journalctl -u barista-staging-web. Nginx remains in maintenance mode.' >&2; exit 1; }
backup=/var/lib/barista-staging-setup/nginx-before-https.conf
install -d -m 700 /var/lib/barista-staging-setup
cp -a "$target" "$backup"
install -m 644 "$release/deploy/staging/nginx-https.conf" "$target"
if ! nginx -t; then cp -a "$backup" "$target"; echo 'HTTPS configuration failed; staging maintenance configuration restored.' >&2; exit 1; fi
systemctl reload nginx
systemctl enable barista-staging-web.service
systemctl enable --now barista-staging-notifications.service
systemctl enable --now barista-staging-job@payments.timer barista-staging-job@cvs.timer barista-staging-job@expiry.timer
echo 'Barista staging activated. Run HTTPS, mail, scanner, native database and restart acceptance checks.'
