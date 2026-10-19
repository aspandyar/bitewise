---
type: note
status: learning
review: false
tags:
  - project/bitewise
  - project/bitewise/deploy
---
# Bitewise — прод и деплой

> Наверх: [[Bitewise]] · связано: [[Projects/Bitewise/architecture|architecture]] · [[Projects/Bitewise/development|development]] · [[Projects/Bitewise/workflow|workflow]]

## Как устроено
- **Сервер:** отдельный небольшой VPS (1–2 ГБ, Ubuntu LTS), всё в `/opt/bitewise`.
- **Стек** (`docker-compose.prod.yml`, проект `bitewise-prod`): `db` (Postgres 17, порт не публикуется), `app` (образ из GHCR, только внутренняя сеть), `nginx` (80/443, TLS, лимиты, 503 во время перезапуска), `certbot` (продление сертификата, профиль `tls`).
- **Образ** собирает GitHub Actions по кнопке (`Release image`, `.github/workflows/release.yml`) — `linux/amd64`, теги `<sha>` и `latest`. Сервер его только скачивает.
- **Релиз** — `docker/scripts/release.sh <tag>`: бэкап → `pull` → миграции и проверки БД → сид → админ → новый `app` → ожидание `/api/health`. Ошибка после бэкапа — откат на прошлый тег (`.release-tag`).
- **Бэкапы** — `docker/scripts/backup.sh` каждую ночь, 14 дней, только на сервере; `restore-check.sh` раз в месяц.

## Первый запуск на новом сервере
1. **Доступ.** Пользователь `deploy` с sudo, вход по ssh-ключу, пароль и root по ssh выключены.
2. **Файрвол:** `ufw allow 22,80,443/tcp && ufw enable`. Больше ничего наружу.
3. **Docker Engine + compose plugin** (официальный репозиторий Docker), `deploy` в группе `docker`.
4. **Каталог:** `sudo mkdir -p /opt/bitewise && sudo chown deploy: /opt/bitewise`.
5. **Файлы стека** с ноутбука (из корня репозитория):
   ```bash
   rsync -av docker-compose.prod.yml docker deploy@<host>:/opt/bitewise/
   ```
6. **`.env`** на сервере из `.env.example`: секция «Production» плюс `POSTGRES_*`, `DATABASE_URL=postgres://bitewise:<пароль>@db:5432/bitewise`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL=https://<домен>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`openssl rand -base64 24`), `DOMAIN`, `CERTBOT_EMAIL`. Затем `chmod 600 .env`. Файл не попадает ни в git, ни в образ, ни в бэкапы; его копия — в менеджере паролей.
7. **Доступ к образу:** на GitHub — fine-grained или classic токен только с `read:packages`; на сервере `docker login ghcr.io -u <github-логин>`.
8. **DNS:** A-запись домена на IP сервера; дождаться, пока `dig +short <домен>` покажет IP.
9. **TLS:** `docker/scripts/init-tls.sh` — временный сертификат, nginx, настоящий сертификат Let's Encrypt, продление каждые 12 ч.
10. **Cron:** `crontab docker/crontab` (бэкап 03:30, проверка восстановления 1-го числа в 05:00; логи — `backups/*.log`).
11. **Первый релиз** — `/deploy` с ноутбука (или вручную: запустить `Release image`, затем на сервере `docker/scripts/release.sh <sha>`).
12. **Проверка:** `https://<домен>` открывается, вход админом, на телефоне — «Установить на телефон».

## Обычный релиз
`/deploy` в Claude Code: lint/test/build → список коммитов → «ок» → `gh workflow run release.yml` → rsync файлов стека → `release.sh <sha>` по ssh → проверка → тег `deploy-<дата>`.

## Откат
```bash
ssh deploy@<host> 'cd /opt/bitewise && docker/scripts/release.sh "$(cat .release-tag.prev)"'
```
Миграции только добавляются, поэтому старый образ работает на новой схеме, пока миграция не удаляет то, что он читает. Перед такой миграцией — отдельный план.

## Восстановление из бэкапа
```bash
cd /opt/bitewise
docker compose -p bitewise-prod -f docker-compose.prod.yml --env-file .env stop app
docker compose -p bitewise-prod -f docker-compose.prod.yml --env-file .env exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/bitewise-<дата>.dump
docker compose -p bitewise-prod -f docker-compose.prod.yml --env-file .env start app
```

## Логи
- Приложение: `docker compose -p bitewise-prod -f docker-compose.prod.yml logs -f app`.
- nginx (доступ, 429, 503): `… logs -f nginx`.
- Бэкапы: `backups/backup.log`, `backups/restore-check.log`.

## Прогон на ноутбуке
Те же файлы и скрипты, другой env-файл и podman вместо Docker:
```bash
mkdir -p .local-prod  # gitignored; app.env — как .env сервера, но DOMAIN=localhost,
                      # PUBLIC_HOST=localhost:9443, HTTP_PORT=9080, HTTPS_PORT=9443, HSTS_MAX_AGE=0
docker build --format docker -t ghcr.io/aspandyar/bitewise:local .
export DOCKER=podman COMPOSE_ENV_FILE=.local-prod/app.env
docker/scripts/init-tls.sh
SKIP_PULL=1 docker/scripts/release.sh local
```
Сайт — `https://localhost:9443` (самоподписанный сертификат).

## Известное
- Страница «не найдено» внутри `<Suspense>` отвечает 200 (стриминг Next), но показывает «Страница не найдена» и `noindex`; несуществующий адрес — 404 (#24).
- Бэкапы только на сервере (решение владельца): сервер пропадёт — пропадут и они.
