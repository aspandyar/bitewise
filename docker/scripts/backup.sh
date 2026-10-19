#!/usr/bin/env bash
# Nightly from cron: a compressed custom-format dump, kept for BACKUP_KEEP_DAYS (default 14).
source "$(dirname "$0")/common.sh"

backup_dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
backup_dir="${backup_dir:-backups}"
keep_days="${BACKUP_KEEP_DAYS:-$(env_value BACKUP_KEEP_DAYS)}"
keep_days="${keep_days:-14}"
mkdir -p "$backup_dir"

file="$backup_dir/bitewise-$(date +%Y%m%d-%H%M%S).dump"
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$file"
# A zero-byte file means pg_dump wrote nothing; never let it count as a backup.
if [ ! -s "$file" ]; then
  rm -f "$file"
  log "backup failed: empty dump"
  exit 1
fi
chmod 600 "$file"
find "$backup_dir" -name 'bitewise-*.dump' -mtime +"$keep_days" -delete
log "backup ok: $file ($(wc -c < "$file") bytes)"
