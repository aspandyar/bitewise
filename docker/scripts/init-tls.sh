#!/usr/bin/env bash
# First start of nginx: it needs a certificate before it can listen on 443, and certbot needs nginx
# to answer the ACME challenge. So: a temporary self-signed certificate, nginx, then the real one.
# DOMAIN=localhost (the local run) stops at a self-signed certificate.
source "$(dirname "$0")/common.sh"

domain="$(env_value DOMAIN)"
email="$(env_value CERTBOT_EMAIL)"
live="/etc/letsencrypt/live/$domain"
certbot=("${COMPOSE[@]}" --profile tls run --rm --entrypoint)

if [ -z "$domain" ]; then
  log "DOMAIN is not set in $ENV_FILE"
  exit 1
fi

self_signed() {
  local days="$1"
  "${certbot[@]}" sh certbot -c "mkdir -p '$live' && openssl req -x509 -nodes -newkey rsa:2048 \
    -days $days -subj '/CN=$domain' -keyout '$live/privkey.pem' -out '$live/fullchain.pem'"
}

if [ "$domain" = "localhost" ]; then
  self_signed 365
  "${COMPOSE[@]}" up -d nginx
  log "self-signed certificate for localhost; nginx is up"
  exit 0
fi

if [ -z "$email" ]; then
  log "CERTBOT_EMAIL is not set in $ENV_FILE"
  exit 1
fi

self_signed 1
"${COMPOSE[@]}" up -d nginx
# The placeholder goes, so certbot writes its own live/ directory instead of refusing to.
"${certbot[@]}" sh certbot -c "rm -rf '$live' '/etc/letsencrypt/archive/$domain' '/etc/letsencrypt/renewal/$domain.conf'"
"${certbot[@]}" certbot certbot certonly --webroot -w /var/www/certbot -d "$domain" \
  --email "$email" --agree-tos --no-eff-email --non-interactive
"${COMPOSE[@]}" exec -T nginx nginx -s reload
"${COMPOSE[@]}" --profile tls up -d certbot
log "certificate for $domain issued; renewal runs every 12 hours"
