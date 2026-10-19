#!/usr/bin/env bash
# One release: backup → migrations → seed → admin → new app container → health.
# Usage: docker/scripts/release.sh <image tag>   (SKIP_PULL=1 for a locally built image)
# Any failure after the backup puts the previous tag back and exits non-zero.
source "$(dirname "$0")/common.sh"

tag="${1:?usage: release.sh <image tag>}"
health_wait_sec="${HEALTH_WAIT_SEC:-60}"
current_file=".release-tag"
previous_tag="$(cat "$current_file" 2> /dev/null || true)"

if [ ! -f "$ENV_FILE" ]; then
  log "$ENV_FILE not found (see docs/deploy.md, step 6)"
  exit 1
fi
# The env file holds the database password and auth secret (#21).
perm="$(stat -c %a "$ENV_FILE" 2> /dev/null || stat -f %Lp "$ENV_FILE")"
if [ "$perm" != "600" ]; then
  log "$ENV_FILE must be chmod 600 (now $perm)"
  exit 1
fi

run_app() {
  IMAGE_TAG="$tag" "${COMPOSE[@]}" run --rm --no-deps app "$@"
}

rollback() {
  if [ -n "$previous_tag" ] && [ "$previous_tag" != "$tag" ]; then
    log "release $tag failed; back to $previous_tag"
    IMAGE_TAG="$previous_tag" "${COMPOSE[@]}" up -d app || true
  else
    log "release $tag failed; no previous tag to return to"
  fi
}

# nginx renders its templates only when the container starts; after rsync brings new ones it has
# to be recreated, or it keeps serving the old limits and headers.
restart_nginx_if_changed() {
  local sum_file=".nginx-templates.sum" sum
  sum="$(cat docker/nginx/* | cksum)"
  if [ "$sum" != "$(cat "$sum_file" 2> /dev/null || true)" ]; then
    "${COMPOSE[@]}" up -d --force-recreate nginx
    echo "$sum" > "$sum_file"
    log "nginx recreated with the new templates"
  fi
}

"${COMPOSE[@]}" up -d db
wait_for_db
docker/scripts/backup.sh

if [ -z "${SKIP_PULL:-}" ]; then
  IMAGE_TAG="$tag" "${COMPOSE[@]}" pull app
fi

trap rollback ERR
# Migrations run before the new container starts, so it never meets an old schema (deploy rules).
run_app node ops/migrate.js
run_app node ops/seed.js
# Before the app accepts sign-ups, so no one can register the admin email first (#17).
run_app node ops/bootstrap-admin.js
IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d app

for ((i = 0; i < health_wait_sec; i++)); do
  if "${COMPOSE[@]}" exec -T app wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    trap - ERR
    # A re-run of the same tag keeps the older one as the rollback target.
    if [ -n "$previous_tag" ] && [ "$previous_tag" != "$tag" ]; then
      echo "$previous_tag" > "$current_file.prev"
    fi
    echo "$tag" > "$current_file"
    restart_nginx_if_changed
    log "release $tag is live"
    exit 0
  fi
  sleep 1
done

log "app did not become healthy within ${health_wait_sec}s"
false
