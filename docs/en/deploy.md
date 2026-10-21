# Bitewise — production and deployment

**English** · [Русский](../ru/deploy.md)

Related: [architecture](architecture.md) · [development](development.md) · [workflow](workflow.md)

## How it is set up
- **Server:** a separate small VPS (1–2 GB, Ubuntu LTS), everything in `/opt/bitewise`.
- **Stack** (`docker-compose.prod.yml`, project `bitewise-prod`): `db` (Postgres 17, no published port), `app` (the GHCR image, internal network only), `nginx` (80/443, TLS, rate limits, 503 during a restart), `certbot` (certificate renewal, profile `tls`); the release steps `migrate`, `seed`, `bootstrap-admin` use the same image, profile `ops`.
- **The image** is built by GitHub Actions on demand (`Release image`, `.github/workflows/release.yml`): `linux/amd64`, tag `<sha>`, label `org.opencontainers.image.revision=<sha>`, the digest in the run's `image-digest` artifact. The server pulls the image by digest and checks the label against the commit, so a swapped tag in the registry or an image from another branch will not start. Base images (`node`, `postgres`, `nginx`, `certbot`) are pinned by digest too; an update is a new tag and digest in one commit.
- **Release:** `docker/scripts/release.sh <sha> <digest>`: backup → the app's database role (`db-role.sh`) → `pull` by digest and the commit check → migrations and database checks → seed → admin → new `app` → wait for `/api/health`. A failure after `pull` rolls back to the previous image (`.release-tag`); before that point the running `app` is not touched.
- **Rights:** the app connects to Postgres with its own role (`APP_DB_USER`): only rows of its tables, no superuser; migrations run as the owner (`POSTGRES_USER`). Every container gets only its own variables: only `bootstrap-admin` sees the admin password, only `db` and `migrate` the Postgres password. `app` and the release steps: read-only file system (except `/tmp` and the Next cache), no capabilities, `no-new-privileges`, memory limits on every service.
- **Backups:** `docker/scripts/backup.sh` every night, kept 14 days, only on the server; `restore-check.sh` once a month.

## First run on a new server
1. **Access.** A `deploy` user with sudo, ssh key login, password and root ssh logins disabled.
2. **Firewall:** `ufw allow 22,80,443/tcp && ufw enable`. Nothing else open.
3. **Docker Engine + the compose plugin** (from Docker's official repository), `deploy` in the `docker` group.
4. **Directory:** `sudo mkdir -p /opt/bitewise && sudo chown deploy: /opt/bitewise`.
5. **Stack files** from the laptop (from the repository root):
   ```bash
   rsync -av docker-compose.prod.yml docker deploy@<host>:/opt/bitewise/
   ```
6. **`.env`** on the server from `.env.example`: the "Production" section plus `POSTGRES_*` (password from `openssl rand -hex 24`: it sits inside a URL, where base64's `/` breaks parsing), `APP_DB_USER=bitewise_app`, `APP_DB_PASSWORD` (also `openssl rand -hex 24`; no `DATABASE_URL`, compose builds it), `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL=https://<domain>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`openssl rand -base64 24`), `DOMAIN`, `CERTBOT_EMAIL`; leave `REGISTRATION` unset: sign-up stays closed until `REGISTRATION=open` (#27). No `$` in any value (compose interpolates it). Then `chmod 600 .env`. The file never goes into git, the image or the backups; keep its copy in a password manager.
7. **Image access:** on GitHub, a classic token with only `read:packages` (GHCR does not accept fine-grained ones); on the server `docker login ghcr.io -u <github-login>`.
8. **DNS:** an A record for the domain pointing to the server's IP; wait until `dig +short <domain>` shows it. No AAAA record until IPv6 is enabled in Docker: otherwise docker-proxy replaces IPv6 clients' addresses with the gateway's, and all of them share one rate-limit bucket.
9. **TLS:** `docker/scripts/init-tls.sh`: a temporary certificate, nginx, the real Let's Encrypt certificate, renewal every 12 h. If issuing failed (DNS not updated yet), run the script again once `dig` shows the IP; don't repeat it often, Let's Encrypt allows 5 identical certificates a week.
10. **Cron:** `crontab docker/crontab` (backup at 03:30, restore check on the 1st at 05:00; logs in `backups/*.log`).
11. **First release:** `/deploy` from the laptop (or by hand: run `Release image`, then `gh run download <run id> -n image-digest`, and on the server `docker/scripts/release.sh <sha> <digest>`).
12. **Check:** `https://<domain>` opens, the admin can sign in, the phone offers "Install on your phone"; `logs nginx` shows real client IPs, not the Docker gateway.

## Regular release
`/deploy` in Claude Code: lint/test/build → the list of commits → "ok" → `gh workflow run release.yml` → the digest from the artifact → rsync of the stack files → `release.sh <sha> <digest>` over ssh → checks → a `deploy-<date>` tag.

## Rollback
```bash
ssh deploy@<host> 'cd /opt/bitewise && docker/scripts/release.sh "$(cat .release-tag.prev)"'
```
`.release-tag` and `.release-tag.prev` hold `<sha>@<digest>`, so a rollback goes by digest too.
Migrations only add things, so an old image works on the new schema until a migration removes something it reads. Such a migration needs its own plan.
A rollback also runs the old seed: foods fixed in the new seed temporarily return to their old numbers and get the new ones back on the next release.

## Restoring from a backup
```bash
cd /opt/bitewise
docker/scripts/compose.sh stop app
docker/scripts/compose.sh exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/bitewise-<date>.dump
docker/scripts/db-role.sh
docker/scripts/compose.sh start app
```
Run `docker/scripts/db-role.sh` before `start app`: a dump taken before the separate role existed has no grants for it.
`compose.sh` is `docker compose` with the project, `.env` and the current image from `.release-tag` (compose cannot parse the stack file without an image).

## Stack changes
- nginx templates: `release.sh` recreates nginx itself if `docker/nginx/*` changed after rsync.
- `docker-compose.prod.yml` for `db`, `nginx` and `certbot`: `docker/scripts/compose.sh up -d db nginx` (and `docker/scripts/compose.sh --profile tls up -d certbot`) after rsync; `release.sh` recreates `app`.

## Logs
- The app: `docker/scripts/compose.sh logs -f app`.
- nginx (access, 429, 503): `… logs -f nginx`.
- Backups: `backups/backup.log`, `backups/restore-check.log`.

## Run on a laptop
The same files and scripts, another env file and podman instead of Docker:
```bash
mkdir -p .local-prod  # gitignored; app.env is like the server's .env, but DOMAIN=localhost,
                      # PUBLIC_HOST=localhost:9443, HTTP_PORT=9080, HTTPS_PORT=9443, HSTS_MAX_AGE=0,
                      # IMAGE_TAG=local
docker build --format docker -t ghcr.io/aspandyar/bitewise:local .
export DOCKER=podman COMPOSE_ENV_FILE=.local-prod/app.env
docker/scripts/init-tls.sh
SKIP_PULL=1 docker/scripts/release.sh local
```
The site is at `https://localhost:9443` (a self-signed certificate).

## Known
- Branch protection for `master` on GitHub (no force-push, pushes only through PRs) is the owner's setting; without it the image is still built only from master, and the server accepts only an image labeled with the expected commit.
- Rootless podman on the laptop does not apply a negative `oom_score_adj` to `db`; on the server (Docker as root) it works.
- A "not found" page inside `<Suspense>` answers 200 (Next streaming) but shows "Page not found" and `noindex`; a nonexistent address is a 404 (#24).
- Backups live only on the server (the owner's decision): if the server is lost, so are they.
- Container logs rotate: 5 files of 10 MB per service.
