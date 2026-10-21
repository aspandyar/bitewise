#!/usr/bin/env bash
# The app logs in as its own role, not the Postgres superuser (#101): with a superuser, any SQL
# injection becomes the whole cluster (COPY ... TO PROGRAM runs commands in the db container).
# Idempotent. release.sh runs it before every migration (an existing database is converted on its
# next release, and a rollback finds the role already there); run it by hand after restoring a
# dump. Tables the migrations add get their grants from the default privileges: the migrator
# connects as the same owner that sets them here.
source "$(dirname "$0")/common.sh"

user="$(env_value APP_DB_USER)"
password="$(env_value APP_DB_PASSWORD)"
owner="$(env_value POSTGRES_USER)"
database="$(env_value POSTGRES_DB)"

# These go into SQL text: allow only plain identifiers (Postgres cuts names at 63 bytes, which
# would break the existence check) and a URL-safe password.
identifier='^[a-z_][a-z0-9_]{0,62}$'
if [[ ! "$user" =~ $identifier ]] || [[ ! "$database" =~ $identifier ]]; then
  log "APP_DB_USER and POSTGRES_DB must be lowercase identifiers of at most 63 characters"
  exit 1
fi
# Altering the owner would strip its own rights; pg_* names are reserved for built-in roles.
if [ "$user" = "$owner" ] || [[ "$user" == pg_* ]]; then
  log "APP_DB_USER must be a separate role, not $user"
  exit 1
fi
if [[ ! "$password" =~ ^[A-Za-z0-9_-]{24,}$ ]]; then
  log "APP_DB_PASSWORD must be at least 24 URL-safe characters (openssl rand -hex 24)"
  exit 1
fi

# The SQL travels over stdin, so the password never shows up in a process list; the first line
# keeps a failing statement (with the password in it) out of the server log.
"${COMPOSE[@]}" exec -T db sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' << SQL
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$user') THEN CREATE ROLE $user; END IF;
END \$\$;
ALTER ROLE $user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '$password';
-- Other databases of the cluster (and the monthly restore_check copy) are not the app's business.
REVOKE CONNECT, TEMPORARY ON DATABASE postgres, template1, $database FROM PUBLIC;
GRANT CONNECT ON DATABASE $database TO $user;
GRANT USAGE ON SCHEMA public TO $user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $user;
SQL
log "database role $user is up to date"
