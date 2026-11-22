# Backups and file storage

## What is stored where

| Data | Where | Survives losing the VPS? |
| --- | --- | --- |
| Database (accounts, jobs, applications, payments) | PostgreSQL on the VPS, plus a nightly backup in Cloudinary | Yes, from the latest nightly backup |
| CVs (new uploads) | Cloudinary, as private files `<folder>/cvs/<key>` | Yes |
| CVs uploaded before Cloudinary storage was switched on | The VPS disk, `PRIVATE_UPLOAD_DIR` | No; they stay readable where they are |
| Profile photos and job covers | Cloudinary, public images | Yes |

Restarting the app or rebooting the server never deletes files on disk. The backups protect against losing the VPS itself.

## CVs in Cloudinary

Set `CV_STORAGE=cloudinary` (with `CLOUDINARY_URL` and `CLOUDINARY_FOLDER`) to store new CVs in Cloudinary. They're uploaded as **private** raw files: they have no public link, and the server fetches them with a short-lived signed request. Downloads still go through the app, so the same permission checks, virus-scan quarantine and "file hasn't changed since submission" check apply.

Each CV record remembers where its file is (`Document.storage`), so switching `CV_STORAGE` only affects new uploads. Existing CVs keep working from wherever they were saved. With `CV_STORAGE=disk` (the default), CVs go to `PRIVATE_UPLOAD_DIR` as before. Tests always use disk and never upload to Cloudinary.

Free Cloudinary accounts block public PDF delivery by default. That doesn't affect CVs, because they're private files fetched by the server.

## Nightly database backup

`scripts/backup-database.mjs` runs `pg_dump` and uploads the dump to Cloudinary as a private file named `<folder>/backups/db-<UTC time>`, then deletes all but the newest `BACKUP_KEEP` (default 14). It's a standalone script with no app code, so it keeps working whatever release is deployed. On the free plan Cloudinary accepts files up to 10 MB; a bigger dump fails with a clear message in the log rather than being skipped silently.

On the VPS it runs from the `evans` crontab at 00:30 server time (02:30 Nairobi), and writes to `shared/logs/backup.log`:

| File on the VPS | From the repository |
| --- | --- |
| `~/barista-platform/shared/bin/backup-database.mjs` | `scripts/backup-database.mjs` |
| `~/barista-platform/shared/bin/run-backup.sh` | `deploy/backup/run-backup.sh` |
| crontab line | `deploy/backup/crontab.txt` |

The script reads `DATABASE_URL`, `CLOUDINARY_URL` and `CLOUDINARY_FOLDER` from `shared/app.env`. Live uses the folder `kbo`; local development uses `kbo-dev`.

To install or update it, from this folder on your PC:

```bash
ssh evans@server.blueledgerpos.app 'mkdir -p ~/barista-platform/shared/bin'
scp scripts/backup-database.mjs deploy/backup/run-backup.sh deploy/backup/crontab.txt evans@server.blueledgerpos.app:barista-platform/shared/bin/
ssh evans@server.blueledgerpos.app '(crontab -l 2>/dev/null | grep -v run-backup.sh; cat ~/barista-platform/shared/bin/crontab.txt) | crontab -'
```

Running it again replaces the backup line rather than adding a second one; other crontab lines are kept.

### Check the backups

```bash
ssh evans@server.blueledgerpos.app 'bash ~/barista-platform/shared/bin/run-backup.sh --list; tail -5 ~/barista-platform/shared/logs/backup.log'
```

Run a backup now (for example before a migration):

```bash
ssh evans@server.blueledgerpos.app 'bash ~/barista-platform/shared/bin/run-backup.sh'
```

### Restore

1. Download the backup you want (names come from `--list`); it's saved in the current folder:

   ```bash
   cd /tmp && bash ~/barista-platform/shared/bin/run-backup.sh --download db-2026-11-22T23-30-00Z
   ```

2. Stop the app, so nothing writes while you restore: `sudo systemctl stop barista-staging-web.service barista-staging-notifications.service`.
3. Restore into the database (this replaces its contents):

   ```bash
   set -a; . ~/barista-platform/shared/app.env; set +a
   pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /tmp/db-2026-11-22T23-30-00Z.dump
   ```

4. Start the app again and delete the downloaded file: `rm /tmp/db-*.dump`.

To restore onto a new server, create an empty database first, then run step 3 against it. Practise a restore into a throwaway database now and then; a backup is only proven once it has been restored.
