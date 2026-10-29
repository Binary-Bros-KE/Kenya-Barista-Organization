#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
target=/etc/nginx/sites-available/barista-staging
link=/etc/nginx/sites-enabled/barista-staging
if [[ -e "$target" || -L "$link" ]]; then
  echo 'A Barista virtual host already exists. Inspect it before repeating this step.' >&2; exit 1
fi
if grep -RqsE 'server_name[[:space:]]+barista-staging\.tanzhotelms\.com[[:space:];]' /etc/nginx/sites-enabled/; then
  echo 'The staging hostname already has a virtual host. Inspect before continuing.' >&2; exit 1
fi
nginx -t
install -d -m 755 /var/www/barista-staging-acme
install -m 644 "$source_dir/nginx-http.conf" "$target"
ln -s "$target" "$link"
if ! nginx -t; then
  [[ -L "$link" && $(readlink "$link") == "$target" ]] && rm -- "$link"
  echo 'New staging site was not activated; its link was removed.' >&2; exit 1
fi
systemctl reload nginx
echo 'Staging ACME/maintenance host enabled. Existing host files were not edited.'
echo 'After DNS points here, run Certbot interactively for this hostname using the documented webroot command.'
