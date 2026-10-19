# Shared by the release scripts: run from the stack root (/opt/bitewise or the repo).
# COMPOSE_ENV_FILE / APP_ENV_FILE point the local run at .local-prod/app.env instead of .env.
# -E: the ERR trap (release rollback) also fires for failures inside functions.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
export APP_ENV_FILE="${APP_ENV_FILE:-$ENV_FILE}"
# DOCKER=podman runs the same scripts with podman (podman compose) on a laptop.
COMPOSE=("${DOCKER:-docker}" compose -p bitewise-prod -f docker-compose.prod.yml --env-file "$ENV_FILE")

# Reads one KEY=value from the env file without sourcing it (values may hold shell characters).
# A missing key is an empty value, not a failure: callers decide what is required.
env_value() {
  { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n 1 | cut -d= -f2-
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

# On a fresh volume Postgres restarts once while it initialises, so "started" is not "ready".
wait_for_db() {
  for ((i = 0; i < ${DB_WAIT_SEC:-60}; i++)); do
    if "${COMPOSE[@]}" exec -T db sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
      > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  log "database is not ready"
  return 1
}
