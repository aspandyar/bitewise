#!/usr/bin/env bash
# docker compose for the prod stack with the project, env file and live image filled in:
#   docker/scripts/compose.sh logs -f app
source "$(dirname "$0")/common.sh"
"${COMPOSE[@]}" "$@"
