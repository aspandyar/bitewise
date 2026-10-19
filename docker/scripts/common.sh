# Shared by the release scripts: run from the stack root (/opt/bitewise or the repo).
# COMPOSE_ENV_FILE / APP_ENV_FILE point the local run at .local-prod/app.env instead of .env.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
export APP_ENV_FILE="${APP_ENV_FILE:-$ENV_FILE}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

# Reads one KEY=value from the env file without sourcing it (values may hold shell characters).
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}
