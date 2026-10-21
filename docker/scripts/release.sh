#!/usr/bin/env bash
# One release: backup → migrations → app role → seed → admin → new app container → health.
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
if [ -z "${SKIP_PULL:-}" ]; then
  if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    log "$usage (digest: gh run download <run id> -n image-digest)"
    exit 1
  fi
  tag="$tag@$digest"
fi
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

# One release step (a service of the "ops" profile) on the new image.
run_step() {
  IMAGE_TAG="$tag" "${COMPOSE[@]}" --profile ops run --rm --no-deps "$1"
}

# The app logs in as its own role, not the Postgres superuser (#101): with a superuser, any SQL
# injection becomes the whole cluster (COPY ... TO PROGRAM runs commands in the db container).
# Idempotent, before every migration: an existing database is converted on its next release and a
# rollback after a failed migration still finds the role. Tables the migrations add get their
# grants from the default privileges (the migrator runs as the same owner).
apply_app_role() {
  local user password database
  user="$(env_value APP_DB_USER)"
  password="$(env_value APP_DB_PASSWORD)"
  database="$(env_value POSTGRES_DB)"
  # These go into SQL text: allow only identifier characters and a URL-safe password.
  if [[ ! "$user" =~ ^[a-z_][a-z0-9_]*$ ]] || [[ ! "$database" =~ ^[a-z_][a-z0-9_]*$ ]]; then
    log "APP_DB_USER and POSTGRES_DB must be lowercase identifiers"
    return 1
  fi
  if [[ ! "$password" =~ ^[A-Za-z0-9_-]{24,}$ ]]; then
    log "APP_DB_PASSWORD must be at least 24 URL-safe characters (openssl rand -hex 24)"
    return 1
  fi
  # The SQL travels over stdin, so the password never shows up in a process list.
  "${COMPOSE[@]}" exec -T db sh -c \
    'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' << SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$user') THEN CREATE ROLE $user; END IF;
END \$\$;
ALTER ROLE $user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '$password';
GRANT CONNECT ON DATABASE $database TO $user;
GRANT USAGE ON SCHEMA public TO $user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $user;
SQL
  log "database role $user is up to date"
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
apply_app_role
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
