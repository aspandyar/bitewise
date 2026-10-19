#!/usr/bin/env bash
# Monthly from cron: restores the newest dump into a throwaway database and counts key rows.
source "$(dirname "$0")/common.sh"

backup_dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
backup_dir="${backup_dir:-backups}"
latest="$(ls -1t "$backup_dir"/bitewise-*.dump 2> /dev/null | head -n 1 || true)"
if [ -z "$latest" ]; then
  log "restore check failed: no dumps in $backup_dir"
  exit 1
fi

db_exec() {
  "${COMPOSE[@]}" exec -T db sh -c "$1"
}

cleanup() {
  db_exec 'dropdb -U "$POSTGRES_USER" --if-exists restore_check' || true
}
trap cleanup EXIT

cleanup
db_exec 'createdb -U "$POSTGRES_USER" restore_check'
db_exec 'pg_restore -U "$POSTGRES_USER" --no-owner -d restore_check' < "$latest"
counts="$(db_exec 'psql -U "$POSTGRES_USER" -d restore_check -At -F " " -c "
  select (select count(*) from users), (select count(*) from foods),
         (select count(*) from diary_entries), (select count(*) from recipes)"')"
read -r users foods entries recipes <<< "$counts"
log "restored $latest: users=$users foods=$foods diary_entries=$entries recipes=$recipes"
# The seed alone puts foods in; zero means the dump or the restore is broken.
if [ "${foods:-0}" -eq 0 ]; then
  log "restore check failed: no foods"
  exit 1
fi
log "restore check ok"
