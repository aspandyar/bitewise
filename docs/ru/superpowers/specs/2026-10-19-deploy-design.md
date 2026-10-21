# Этап 6б — `ft/deploy`: прод на своём VPS

Дата: 2026-10-19 · Статус: реализовано (без первого деплоя — нет сервера) · Ветка: `ft/deploy` (от `master`)

## Цель
Всё, что нужно для прода, лежит в репозитории и проверено на ноутбуке: образ, compose, nginx + TLS, шаги релиза, бэкапы, runbook. Когда появятся сервер и домен (#8), первый запуск — один заход по runbook и `/deploy`.

**Готово, когда:**
- прод-стек (`docker-compose.prod.yml`) поднимается локально одной командой с `DOMAIN=localhost` и самоподписанным сертификатом;
- `release.sh` проходит дважды — на пустой и на живой базе: бэкап, миграции, сид, админ, старт, здоровье;
- заголовки (CSP, HSTS), `limit_req`, 503 во время перезапуска на месте; порты приложения и БД снаружи закрыты;
- бэкап восстанавливается `restore-check.sh`;
- workflow `release.yml` собирает `linux/amd64` и кладёт образ в GHCR;
- `pnpm lint`, `pnpm test`, CI зелёные.

Для этапа 6 целиком «приложение стоит на телефоне и живёт на своём домене» закрывается первым `/deploy` на настоящем сервере.

## Принятые решения (обсуждение 2026-10-19)
| Вопрос | Решение | Почему |
| --- | --- | --- |
| Сервер | отдельный небольшой VPS (1–2 ГБ) только под Bitewise; nginx и certbot — контейнерами в compose | весь сервер описан в репозитории и поднимается с нуля |
| Сборка образа | GitHub Actions по кнопке (`workflow_dispatch`) → GHCR (приватный), теги `sha` и `latest`; сервер только `pull` | серверу не нужна память на сборку Next; у каждого релиза тег для отката; «деплой только вручную» сохраняется |
| Миграции, сид, админ | один образ: esbuild собирает `migrate`/`seed`/`bootstrap-admin` в `ops/*.js`, миграции — мигратор `drizzle-orm` (та же таблица `__drizzle_migrations`) | на сервере ровно код из CI; без второго образа с dev-зависимостями |
| Бэкапы | `pg_dump` каждую ночь, только на сервере, 14 дней; проверка восстановления раз в месяц | выбор владельца; риск: пропадёт сервер — пропадут и бэкапы |
| CSP (#18) | строгий во всём, кроме `script-src 'self' 'unsafe-inline'` | хэш несовместим с inline-скриптами Next, nonce отключает статические оболочки `cacheComponents` |

## Отступления при реализации
- Проект compose назван `bitewise-prod` (и `-p` в скриптах): с именем по каталогу прод-стек на ноутбуке взял бы контейнер и volume dev-базы.
- Скрипты: `DOCKER=podman` для локального прогона (в zsh `docker` — алиас, в bash его нет); ожидание готовности БД; `set -E`; порты локально 9080/9443 (8080 занят).
- Сид пересчитывает не «изменённые в этом прогоне», а все блюда, у которых общий ингредиент новее самого блюда: так сбой или обрыв после коммита догоняется следующим прогоном.
- nginx: `default_server` отвергает чужие Host/SNI, `Host` и `X-Forwarded-Host` — `$http_host` (с портом, иначе Next отклоняет server actions на нестандартном порту), `/api/health` снаружи — 404, `server_tokens off`, шифры Mozilla intermediate; `release.sh` пересоздаёт nginx при новых шаблонах; ротация логов контейнеров.
- `client_max_body_size`, ставки `limit_req` и `Retry-After` — в шаблоне nginx, а не в `lib/config.ts`: это настройки прокси, приложение их не читает.
- CI: `packages: write` только у job сборки, образ — только из master.
- Семафор: неудачный dummy-хеш не кэшируется (иначе неизвестные email отвечали бы мгновенно).
- #24 — 200 + `noindex` внутри `<Suspense>`, оставлено; #26 — ~40 мс на сервере и префетч ссылок, `useLinkStatus` не нужен.

## Образ (`Dockerfile`, Docker и podman)
1. `deps` — `pnpm install --frozen-lockfile`.
2. `build` — `next build` (`output: "standalone"`); esbuild → `ops/migrate.js`, `ops/seed.js`, `ops/bootstrap-admin.js`. На этой стадии `ENV` — несекретные заглушки `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (#19): модули читают env при импорте, а в итоговый образ стадия не попадает.
3. `runner` — `node:24-alpine`, пользователь `node`; standalone, `.next/static`, `public`, `db/migrations`, `db/seed/foods.json`, `ops/`. `HEALTHCHECK` — `GET /api/health`.

`GET /api/health` — новый маршрут: `select 1` к базе → 200 `{ ok: true }` или 503, без подробностей и без сессии.

## Compose (`docker-compose.prod.yml`)
- `db` — `postgres:17-alpine` (как в dev), именованный volume, порт не публикуется.
- `app` — `ghcr.io/aspandyar/bitewise:${IMAGE_TAG}`, только внутренняя сеть, `env_file: .env` (600, не в образе и не в git).
- `nginx` — официальный образ, 80/443, шаблоны из `docker/nginx/`.
- `certbot` — продление раз в 12 ч (webroot).

## Шаги релиза (`docker/scripts/release.sh`, вызывает `/deploy`)
0. Отказ, если у `.env` права шире 600 (#21).
1. Бэкап (`backup.sh`).
2. `docker compose pull app` (тег из `IMAGE_TAG`).
3. `docker compose run --rm app node ops/migrate.js` — мигратор + проверки: `lower('ГРЕЧКА') = 'гречка'` (#25), расширение `pg_trgm` есть (#22).
4. `node ops/seed.js` (#22).
5. `node ops/bootstrap-admin.js` (#17).
6. `docker compose up -d app`, ожидание `healthy`.
7. Ошибка на любом шаге — откат `app` на прошлый тег и ненулевой код выхода.

## nginx (`docker/nginx/*.conf.template`, `DOMAIN` из env)
- 80: `/.well-known/acme-challenge/` (webroot) и редирект на https.
- 443: TLS 1.2/1.3, HSTS на год без preload, gzip (brotli нет в официальном образе), `immutable`-кэш для `/_next/static` и иконок.
- К приложению (#18): `X-Forwarded-For $proxy_add_x_forwarded_for` (совпадает с `TRUSTED_PROXY_HOPS = 1`), `X-Forwarded-Proto`, `Host`; `client_max_body_size 1m` (под фото — этап 11).
- `limit_req` по IP на `/api/auth/callback/` и POST `/register` — внешний слой поверх лимитов приложения.
- Приложение недоступно (перезапуск) → 503 с `Retry-After`, а не обрыв соединения.

## TLS
`docker/scripts/init-tls.sh`: временный самоподписанный сертификат → nginx → `certbot certonly --webroot` → перезагрузка nginx. Дальше certbot проверяет продление каждые 12 ч, nginx перечитывает сертификат каждые 6 ч. Локально (`DOMAIN=localhost`) — только самоподписанный.

## Заголовки
- CSP — в `next.config.ts` (одинаков во всех окружениях): `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
- `Permissions-Policy`: `camera=(self), microphone=(), geolocation=()` (камера — сканер этапа 7).
- HSTS — в nginx.

## Бэкапы
- `docker/scripts/backup.sh` — `pg_dump -Fc` → `/opt/bitewise/backups/bitewise-<дата>.dump`, удаление старше 14 дней.
- `docker/scripts/restore-check.sh` — последний дамп во временную базу того же контейнера, сверка числа строк (`users`, `foods`, `diary_entries`, `recipes`), удаление временной базы; итог в лог.
- `docker/crontab` — ночной бэкап и ежемесячная проверка; установка — в runbook.
- Файлы на сервер (compose, шаблоны, скрипты) копирует `/deploy` через rsync; git на сервере не нужен.

## Код по issues
- **#20** — семафор на scrypt: не больше `PASSWORD_HASH.maxConcurrent = 2` одновременно, очередь до `maxQueued = 20`, дальше — отказ «слишком много запросов». Тесты: одновременность, порядок, переполнение.
- **#23** — транзакция сида пишет продукты и порции и возвращает id изменившихся; блюда пересчитываются после коммита, каждое в своей транзакции (та же блокировка строки блюда). db-тест: блюдо пересчитано; сбой одного блюда не откатывает сид.
- **#24** — проверка `curl -I` на prod-сборке; если стриминг оставляет 200, — известное ограничение Next, приложение за входом и не индексируется: ответ в issue, без перестройки кода.
- **#26** — замер на prod-сборке за nginx; если реакция на тап > 300 мс — мгновенный отклик ссылки (`useLinkStatus`) в списках продуктов и недавних.
- `.env.example` — `DOMAIN`, `CERTBOT_EMAIL`, `IMAGE_TAG`.

## Проверка
- Unit/db-тесты: семафор, сид (#23), мигратор с проверками (на тестовой базе), `/api/health`, CSP-строка из config.
- Локальный прогон стека (podman/Docker): релиз на пустой и живой базе, `curl -I` (CSP, HSTS, 503), серия входов → 429, порты 3000/5432 закрыты снаружи, `restore-check.sh`.
- Субагенты: reviewer, security-reviewer.

## Документы
- `docs/ru/deploy.md` — runbook первого запуска: пользователь, Docker, файрвол (22/80/443), `.env`, DNS, `init-tls.sh`, cron, первый `/deploy`.
- Скилл `/deploy` — под новые скрипты.
- `architecture.md`, `notes.md`, `PROJECT_PLAN.md`.

## Новые зависимости
`esbuild` (dev, явно) — сборка скриптов релиза в JS; сейчас приходит транзитивно через tsx, полагаться на это хрупко. Миграций БД нет.

## Вне этапа
- Внешняя копия бэкапов (решение владельца — только сервер).
- Мониторинг и алерты, логи вне сервера.
- #95 (идемпотентность при автоповторе) — отдельно.
