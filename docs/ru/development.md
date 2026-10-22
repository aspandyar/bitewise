---
type: note
status: learning
review: false
tags:
  - project/bitewise
  - project/bitewise/development
---
# Bitewise — локальная разработка

[English](../en/development.md) · **Русский**

> Наверх: [[Bitewise]] · связано: [[Projects/Bitewise/architecture|architecture]] · [[Projects/Bitewise/workflow|workflow]] · [[Projects/Bitewise/api|api]]

## Что нужно
- **Node ≥ 24** и **pnpm** (версия закреплена в `package.json` → `packageManager`).
- **Docker или Podman** с compose — только для Postgres. Приложение в dev запускается напрямую (`pnpm dev`), отдельного сервиса `app` в compose нет.

## Первый запуск
```bash
pnpm install
cp .env.example .env
docker compose up -d --wait db
pnpm db:migrate
pnpm db:seed
pnpm admin:bootstrap   # по желанию
pnpm dev
```
Регистрация по умолчанию закрыта (`REGISTRATION`, ниже): либо войти администратором из `pnpm admin:bootstrap`, либо добавить в `.env` строку `REGISTRATION=open`. Затем http://localhost:3000 → вход или «Зарегистрироваться» → онбординг (профиль) → главная с дневником.

## Переменные окружения
Шаблон — `.env.example` (в git). Сам `.env` в git не попадает. Проверка переменных — zod в `lib/env-read.ts` (приложение импортирует его через `lib/env.ts`, помеченный `server-only`): приложение падает при старте, а не на первом запросе.

| Переменная | Где нужна | Примечание |
| --- | --- | --- |
| `DATABASE_URL` | приложение, drizzle-kit, сид, скрипты | dev-база: `localhost:5433/bitewise` |
| `DATABASE_URL_TEST` | `pnpm test` (db-тесты) | отдельная база `bitewise_test`; тесты её очищают |
| `NEXTAUTH_SECRET` | приложение | не короче 32 символов, подписывает JWT-сессии; `openssl rand -base64 32` |
| `NEXTAUTH_URL` | приложение | в production — только `https` (кроме localhost) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `pnpm admin:bootstrap` | создаёт или синхронизирует единственного администратора (по умолчанию `admin@bitewise.invalid`); смена пароля в `.env` + повторный запуск — ротация; падает, если email уже занят обычным аккаунтом |
| `REGISTRATION` | приложение | `open` или `closed` (по умолчанию): регистрация закрыта, пока нет защиты от ботов и перебора email (#27); неизвестное значение останавливает сервер при старте |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | `docker-compose.yml` | по умолчанию `bitewise` / `bitewise` / `bitewise` / `5433` |

Ключи AI (этапы 9–12) будут жить только в env на сервере, никогда в клиентском коде.

Переменные production (`APP_DB_*`, `DOMAIN`, TLS, бэкапы) — в секции «Production» `.env.example` и в [deploy.md](deploy.md).

## Сервер и скрипты
- `db/client.ts` и `lib/env.ts` помечены `server-only`: импорт базы или секретов в клиентский компонент — ошибка сборки (#32).
- Скрипты (сид, `admin:bootstrap`, миграции в образе, `drizzle.config.ts`) работают вне Next, где `server-only` падает, и используют `db/connect.ts` и `lib/env-read.ts`. В коде приложения эти входы запрещает ESLint.
- `pnpm dev` и `pnpm build` сначала запускают `pnpm wasm:copy`: декодер штрихкодов (`zxing_reader.wasm` из `node_modules`) копируется в `public/zxing/` (в git не попадает) и раздаётся своим сайтом — CSP не пускает его с CDN.
- `instrumentation.ts` при старте сервера чистит логи ошибок от SQL-параметров (#76) и проверяет `REGISTRATION`.

## База данных
- `docker compose up -d db` поднимает Postgres 17 на `127.0.0.1:5433`: порт 5432 занят другим локальным проектом, наружу база не слушает.
- При **первом** создании volume init-скрипт `docker/postgres/init-test-db.sql` создаёт вторую базу `bitewise_test`. Если volume уже был, скрипт не сработает — тестовую базу придётся создать вручную или пересоздать volume.
- `pg_trgm` подключается миграцией `0002_enable_pg_trgm.sql`.

### Миграции
Схема — только в `db/schema.ts`. Порядок (навык `/db-change`):
1. Изменить `db/schema.ts`.
2. `pnpm db:generate` → новый файл в `db/migrations/`.
3. Прочитать SQL целиком: потеря данных, блокировки, `NOT NULL` без default.
4. `pnpm db:migrate` на dev-базе. Тестовая база мигрирует сама при каждом `pnpm test`.

Нельзя: править сгенерированные миграции и пользоваться `drizzle-kit push`. Ещё одна ловушка — новое значение enum. Drizzle применяет все новые миграции **одной транзакцией**, а значение enum нельзя использовать в той же транзакции, где его добавили. Поэтому этап 4 обошёлся без нового значения в `food_source`.

### Сид продуктов
- `db/seed/sources/usda.json` (209 продуктов) и `label.json` (13) — исходники с переводом названий и порциями.
- `pnpm seed:build <каталог CSV USDA SR Legacy>` собирает из них `db/seed/foods.json`. Архив USDA лежит в `.cache/`, вне git.
- `pnpm db:seed` делает upsert по `seed_key`: повторный запуск безопасен. Исчезнувшие ключи получают `deleted_at`, у изменённых продуктов пересчитываются блюда пользователей.

## Тесты
Vitest с двумя проектами (`vitest.config.ts`):

| Проект | Файлы | Особенности |
| --- | --- | --- |
| `unit` | `**/*.test.ts` | без БД и сети, параллельно |
| `db` | `**/*.db.test.ts` | `tests/global-setup.ts` мигрирует `bitewise_test`; файлы идут по очереди (`fileParallelism: false`); `resetDb()` делает `TRUNCATE users CASCADE` перед каждым тестом |

- `pnpm test` — всё, `pnpm test:unit` — только unit, `pnpm vitest run lib/recipes` — выборочно.
- Хелперы: `tests/db.ts` (`testDb`, `resetDb`, `closeTestDb`, `createTestPool` для тестов гонок), `tests/foods.ts` (`newUserId`, `insertSharedFood`, `insertSharedPortion`, `createOwnFood`), `tests/recipes.ts` (`insertRecipeFood`).
- Расчёты пишутся по TDD: сначала тест с числами, посчитанными вручную, потом код (`.claude/rules/testing.md`). Тесты нельзя ослаблять, чтобы они прошли.
- Внешние API (USDA, Open Food Facts, AI) — только через fixtures в `tests/fixtures/`, без сети.

## Линт и формат
- `pnpm lint` = ESLint → `next typegen` (типы роутов, без них `tsc` падает) → `tsc --noEmit`. TypeScript: `strict` + `noUncheckedIndexedAccess`.
- Хук Claude Code после каждой правки: Prettier + `eslint --fix` для ts/tsx, Prettier для css/json/md. Вручную — `pnpm format`. Каталоги `docs/` и `.claude/` и файл `CLAUDE.md` Prettier не трогает: `docs/ru/` — заметки Obsidian.

## CI
`.github/workflows/ci.yml` на каждый push и PR: Postgres 17 как service → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test`. Полный прогон занимает около минуты. Мерж в `master` — только при зелёном CI.

## Камера на телефоне (туннель)
Камера работает только по https (или на `localhost`), поэтому по адресу ноутбука в домашней сети сканер показывает только ручной ввод. Для проверки на телефоне — именованный туннель Cloudflare на prod-сборку ноутбука:

1. Один раз: `cloudflared tunnel login` (зона `aspandyar.org`), `cloudflared tunnel create bitewise-dev`, `cloudflared tunnel route dns bitewise-dev bitewise-dev.aspandyar.org`. Конфиг — отдельный файл `~/.cloudflared/bitewise-dev.yml` (`ingress`: `bitewise-dev.aspandyar.org` → `http://localhost:3000`); ключ туннеля — JSON рядом, в git не попадает.
2. На время проверки: `NEXTAUTH_URL=https://bitewise-dev.aspandyar.org` в `.env`, `pnpm build && pnpm start`, затем `cloudflared tunnel --config ~/.cloudflared/bitewise-dev.yml run`.
3. После — остановить туннель и вернуть `NEXTAUTH_URL`: пока он смотрит на туннель, вход через `localhost` не работает.

Поддомен — одного уровня: бесплатный сертификат Cloudflare не покрывает `*.*.aspandyar.org`.

## Частые проблемы
- **Форма или поиск показывают старые значения после возврата на экран.** `cacheComponents` держит скрытые экраны живыми вместе с их состоянием. Клиентской форме на таком экране нужен `key` из входных данных или обёртка `ResetOnHide` (`components/ui/reset-on-hide.tsx`). См. `.claude/rules/ui.md`.
- **Сессия и cookie читаются только внутри `<Suspense>`.** Каждая страница устроена как `Page` → `<Suspense fallback={<PageLoading />}>` → `…Content`, и `requireUserId()` вызывается внутри `…Content`.
- **Локально `pnpm test` иногда идёт 15–30 минут при почти нулевом CPU.** Код тут ни при чём: на CI тот же код проходит меньше чем за минуту. Это особенность окружения (Podman или macOS, когда процесс в фоне); повторный запуск на переднем плане обычно проходит за 10–20 секунд. При сильной загрузке машины тесты scrypt могут упасть по таймауту; по отдельности они проходят.
- **Прод-стек целиком на ноутбуке** (nginx, TLS, роль базы, релиз и откат) — раздел «Прогон на ноутбуке» в [deploy.md](deploy.md).
- **`AGENTS.md` переписывается `next dev`.** Это блок с правилами Next.js для агентов, его можно коммитить как есть.
