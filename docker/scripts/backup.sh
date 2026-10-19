#!/usr/bin/env bash
# Nightly from cron: a compressed custom-format dump, kept for BACKUP_KEEP_DAYS (default 14).
source "$(dirname "$0")/common.sh"

backup_dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
backup_dir="${backup_dir:-backups}"
keep_days="${BACKUP_KEEP_DAYS:-$(env_value BACKUP_KEEP_DAYS)}"
keep_days="${keep_days:-14}"
# Dumps hold every user's diary: nobody else on the host reads them, not even mid-write.
umask 077
mkdir -p -m 700 "$backup_dir"

file="$backup_dir/bitewise-$(date +%Y%m%d-%H%M%S).dump"
# Written under a temporary name and moved in only when complete, so a cut-off dump never looks
# like a backup to restore-check or to whoever restores.
partial="$file.partial"
trap 'rm -f "$partial"' EXIT
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$partial"
if [ ! -s "$partial" ]; then
  log "backup failed: empty dump"
  exit 1
fi
mv "$partial" "$file"
find "$backup_dir" -name 'bitewise-*.dump' -mtime +"$keep_days" -delete
log "backup ok: $file ($(wc -c < "$file") bytes)"
