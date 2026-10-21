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
- **Стек** (`docker-compose.prod.yml`, проект `bitewise-prod`): `db` (Postgres 17, порт не публикуется), `app` (образ из GHCR, только внутренняя сеть), `nginx` (80/443, TLS, лимиты, 503 во время перезапуска), `certbot` (продление сертификата, профиль `tls`); шаги релиза `migrate`, `seed`, `bootstrap-admin` — тот же образ, профиль `ops`.
- **Образ** собирает GitHub Actions по кнопке (`Release image`, `.github/workflows/release.yml`) — `linux/amd64`, тег `<sha>`, метка `org.opencontainers.image.revision=<sha>`, digest — в артефакте `image-digest` запуска. Сервер скачивает образ по digest и сверяет метку с коммитом: подмена тега в реестре или образ из другой ветки не запустятся. Базовые образы (`node`, `postgres`, `nginx`, `certbot`) тоже закреплены по digest; обновление — новый тег и digest одним коммитом.
- **Релиз** — `docker/scripts/release.sh <sha> <digest>`: бэкап → роль приложения в БД (`db-role.sh`) → `pull` по digest и сверка коммита → миграции и проверки БД → сид → админ → новый `app` → ожидание `/api/health`. Ошибка после `pull` — откат на прошлый образ (`.release-tag`); до этого работающий `app` не трогается.
- **Права:** приложение ходит в Postgres своей ролью (`APP_DB_USER`) — только строки своих таблиц, без суперпользователя; миграции — владельцем (`POSTGRES_USER`). Каждый контейнер получает только свои переменные: пароль админа видит только `bootstrap-admin`, пароль Postgres — только `db` и `migrate`. `app` и шаги релиза: файловая система только для чтения (кроме `/tmp` и кэша Next), без capabilities, `no-new-privileges`, лимиты памяти у всех сервисов.
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
6. **`.env`** на сервере из `.env.example`: секция «Production» плюс `POSTGRES_*` (пароль — `openssl rand -hex 24`: он стоит внутри URL, а `/` из base64 ломает разбор), `APP_DB_USER=bitewise_app`, `APP_DB_PASSWORD` (тоже `openssl rand -hex 24`; `DATABASE_URL` не нужен — его собирает compose), `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL=https://<домен>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`openssl rand -base64 24`), `DOMAIN`, `CERTBOT_EMAIL`; `REGISTRATION` не задавать — регистрация закрыта, пока не будет `REGISTRATION=open` (#27). В значениях не должно быть `$` (compose подставляет переменные). Затем `chmod 600 .env`. Файл не попадает ни в git, ни в образ, ни в бэкапы; его копия — в менеджере паролей.
7. **Доступ к образу:** на GitHub — classic-токен только с `read:packages` (fine-grained GHCR не принимает); на сервере `docker login ghcr.io -u <github-логин>`.
8. **DNS:** A-запись домена на IP сервера; дождаться, пока `dig +short <домен>` покажет IP. AAAA-запись не заводить, пока в Docker не включён IPv6: иначе docker-proxy подменит адрес IPv6-клиентов адресом шлюза, и все они окажутся в одной корзине лимитов.
9. **TLS:** `docker/scripts/init-tls.sh` — временный сертификат, nginx, настоящий сертификат Let's Encrypt, продление каждые 12 ч. Если выпуск упал (DNS ещё не обновился), запустить скрипт снова, когда `dig` покажет IP; часто не повторять — у Let's Encrypt лимит 5 одинаковых сертификатов в неделю.
10. **Cron:** `crontab docker/crontab` (бэкап 03:30, проверка восстановления 1-го числа в 05:00; логи — `backups/*.log`).
11. **Первый релиз** — `/deploy` с ноутбука (или вручную: запустить `Release image`, затем `gh run download <id запуска> -n image-digest` и на сервере `docker/scripts/release.sh <sha> <digest>`).
12. **Проверка:** `https://<домен>` открывается, вход админом, на телефоне — «Установить на телефон»; в `logs nginx` видны настоящие IP клиентов, а не адрес шлюза Docker.

## Обычный релиз
`/deploy` в Claude Code: lint/test/build → список коммитов → «ок» → `gh workflow run release.yml` → digest из артефакта → rsync файлов стека → `release.sh <sha> <digest>` по ssh → проверка → тег `deploy-<дата>`.

## Откат
```bash
ssh deploy@<host> 'cd /opt/bitewise && docker/scripts/release.sh "$(cat .release-tag.prev)"'
```
В `.release-tag` и `.release-tag.prev` — `<sha>@<digest>`, откат тоже идёт по digest.
Миграции только добавляются, поэтому старый образ работает на новой схеме, пока миграция не удаляет то, что он читает. Перед такой миграцией — отдельный план.
Откат запускает и старый сид: продукты, исправленные в новом сиде, временно вернутся к прежним цифрам и вернутся к новым при следующем релизе.

## Восстановление из бэкапа
```bash
cd /opt/bitewise
docker/scripts/compose.sh stop app
docker/scripts/compose.sh exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/bitewise-<дата>.dump
docker/scripts/db-role.sh
docker/scripts/compose.sh start app
```
Перед `start app` — `docker/scripts/db-role.sh`: у дампа, снятого до отдельной роли, нет прав для неё.
`compose.sh` — `docker compose` с проектом, `.env` и текущим образом из `.release-tag` (без образа compose не разбирает файл стека).

## Изменения стека
- Шаблоны nginx: `release.sh` сам пересоздаёт nginx, если `docker/nginx/*` изменились после rsync.
- `docker-compose.prod.yml` для `db`, `nginx` и `certbot`: `docker/scripts/compose.sh up -d db nginx` (и `docker/scripts/compose.sh --profile tls up -d certbot`) после rsync; `app` пересоздаёт `release.sh`.

## Логи
- Приложение: `docker/scripts/compose.sh logs -f app`.
- nginx (доступ, 429, 503): `… logs -f nginx`.
- Бэкапы: `backups/backup.log`, `backups/restore-check.log`.

## Прогон на ноутбуке
Те же файлы и скрипты, другой env-файл и podman вместо Docker:
```bash
mkdir -p .local-prod  # gitignored; app.env — как .env сервера, но DOMAIN=localhost,
                      # PUBLIC_HOST=localhost:9443, HTTP_PORT=9080, HTTPS_PORT=9443, HSTS_MAX_AGE=0,
                      # IMAGE_TAG=local
docker build --format docker -t ghcr.io/aspandyar/bitewise:local .
export DOCKER=podman COMPOSE_ENV_FILE=.local-prod/app.env
docker/scripts/init-tls.sh
SKIP_PULL=1 docker/scripts/release.sh local
```
Сайт — `https://localhost:9443` (самоподписанный сертификат).

## Известное
- Защита ветки `master` на GitHub (запрет force-push, пуш только через PR) — настройка владельца; без неё образ по-прежнему собирается только из master, а сервер принимает только образ с меткой нужного коммита.
- Rootless podman на ноутбуке не ставит отрицательный `oom_score_adj` у `db` — на сервере (Docker от root) он работает.
- Страница «не найдено» внутри `<Suspense>` отвечает 200 (стриминг Next), но показывает «Страница не найдена» и `noindex`; несуществующий адрес — 404 (#24).
- Бэкапы только на сервере (решение владельца): сервер пропадёт — пропадут и они.
- Логи контейнеров ротируются: 5 файлов по 10 МБ на сервис.
