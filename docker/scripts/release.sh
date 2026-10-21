#!/usr/bin/env bash
# One release: backup → pull by digest → app role → migrations → seed → admin → new app → health.
# Usage: docker/scripts/release.sh <commit sha> <sha256:digest>
#        docker/scripts/release.sh "$(cat .release-tag.prev)"   (rollback: <sha>@<digest>)
#        SKIP_PULL=1 docker/scripts/release.sh <tag>   (locally built image, no digest)
# The image is pulled by digest (from the workflow's image-digest artifact), so a tag re-pointed
# in the registry cannot change what runs (#103).
# Any failure after the backup puts the previous release back and exits non-zero.
source "$(dirname "$0")/common.sh"

usage="usage: release.sh <commit sha> <sha256:digest>"
tag="${1:?$usage}"
digest="${2:-}"
if [[ "$tag" == *@* ]]; then
  digest="${tag#*@}"
  tag="${tag%%@*}"
fi
commit="$tag"
if [ -n "${SKIP_PULL:-}" ]; then
  # A local image has its own digest; one from the registry would never match it.
  if [ -n "$digest" ]; then
    log "SKIP_PULL runs a locally built image: pass its tag without a digest"
    exit 1
  fi
else
  if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    log "$usage (full commit sha; digest: gh run download <run id> -n image-digest)"
    exit 1
  fi
  tag="$commit@$digest"
fi
image="ghcr.io/aspandyar/bitewise:$tag"
health_wait_sec="${HEALTH_WAIT_SEC:-60}"
current_file=".release-tag"
previous_tag="$(cat "$current_file" 2> /dev/null || true)"

if [ ! -f "$ENV_FILE" ]; then
  log "$ENV_FILE not found (see docs/ru/deploy.md, step 6)"
  exit 1
fi
# The env file holds the database password and auth secret (#21).
perm="$(stat -c %a "$ENV_FILE" 2> /dev/null || stat -f %Lp "$ENV_FILE")"
if [ "$perm" != "600" ]; then
  log "$ENV_FILE must be chmod 600 (now $perm)"
  exit 1
fi

# One release step (a service of the "ops" profile) on the new image.
run_step() {
  IMAGE_TAG="$tag" "${COMPOSE[@]}" --profile ops run --rm --no-deps "$1"
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

# Before the rollback trap: until here nothing about the running app has changed, and a refused
# role or a failed pull must not recreate it.
docker/scripts/db-role.sh

if [ -z "${SKIP_PULL:-}" ]; then
  # Pulled here, not by compose (pull_policy: never): the digest pins the content, and the label
  # ties it to the commit, so an image built from another branch is refused (#103).
  "${DOCKER:-docker}" pull "$image"
  revision="$("${DOCKER:-docker}" image inspect --format \
    '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  if [ "$revision" != "$commit" ]; then
    log "image $digest was built from ${revision:-an unknown commit}, not $commit"
    exit 1
  fi
fi

trap rollback ERR
# Migrations run before the new container starts, so it never meets an old schema (deploy rules).
# They alone run as the owner; seed and admin only change rows, so they use the app role.
run_step migrate
run_step seed
# Before the app accepts sign-ups, so no one can register the admin email first (#17).
run_step bootstrap-admin
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
