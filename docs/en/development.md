# Bitewise — local development

**English** · [Русский](../ru/development.md)

Related: [architecture](architecture.md) · [workflow](workflow.md) · [API](api.md)

## Requirements
- **Node ≥ 24** and **pnpm** (the version is pinned in `package.json` → `packageManager`).
- **Docker or Podman** with compose, only for Postgres. In development the app runs directly (`pnpm dev`); compose has no `app` service.

## First run
```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:migrate
pnpm db:seed
pnpm admin:bootstrap   # optional
pnpm dev
```
Sign-up is closed by default (`REGISTRATION`, below): either sign in as the admin from `pnpm admin:bootstrap`, or add `REGISTRATION=open` to `.env`. Then http://localhost:3000 → sign in or "Зарегистрироваться" (sign up) → onboarding (profile) → the home screen with the diary.

## Environment variables
The template is `.env.example` (in git). `.env` itself never goes into git. Variables are checked by zod in `lib/env-read.ts` (the app imports it through `lib/env.ts`, marked `server-only`): the app fails at start, not on the first request.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the app, drizzle-kit, seed, scripts | dev database: `127.0.0.1:5433/bitewise` |
| `DATABASE_URL_TEST` | `pnpm test` (db tests) | a separate `bitewise_test` database; tests wipe it |
| `NEXTAUTH_SECRET` | the app | at least 32 characters, signs JWT sessions; `openssl rand -base64 32` |
| `NEXTAUTH_URL` | the app | only `https` in production (except localhost) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `pnpm admin:bootstrap` | creates or syncs the single admin (default `admin@bitewise.invalid`); change the password in `.env` and re-run to rotate it; fails if the email belongs to a regular account |
| `REGISTRATION` | the app | `open` or `closed` (default): sign-up is closed until there is protection against bots and email probing (#27); an unknown value stops the server at start |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | `docker-compose.yml` | defaults `bitewise` / `bitewise` / `bitewise` / `5433` |

AI keys (stages 9–12) will live only in the server's env, never in client code.

Production variables (`APP_DB_*`, `DOMAIN`, TLS, backups) are in the "Production" section of `.env.example` and in [deploy.md](deploy.md).

## Server and scripts
- `db/client.ts` and `lib/env.ts` are marked `server-only`: importing the database or secrets into a client component fails the build (#32).
- Scripts (seed, `admin:bootstrap`, the image's migrations, `drizzle.config.ts`) run outside Next, where `server-only` throws, and use `db/connect.ts` and `lib/env-read.ts`. ESLint forbids these entries in app code.
- At server start `instrumentation.ts` scrubs SQL parameters from error logs (#76) and checks `REGISTRATION`.

## Database
- `docker compose up -d db` starts Postgres 17 on `127.0.0.1:5433`: port 5432 is taken by another local project, and the database does not listen outside.
- On the **first** creation of the volume, the init script `docker/postgres/init-test-db.sql` creates a second database, `bitewise_test`. If the volume already existed, the script does not run: create the test database by hand or recreate the volume.
- `pg_trgm` is enabled by the migration `0002_enable_pg_trgm.sql`.

### Migrations
The schema lives only in `db/schema.ts`. The steps (the `/db-change` skill):
1. Change `db/schema.ts`.
2. `pnpm db:generate` → a new file in `db/migrations/`.
3. Read the whole SQL: data loss, locks, `NOT NULL` without a default.
4. `pnpm db:migrate` on the dev database. The test database migrates itself on every `pnpm test`.

Don't edit generated migrations and don't use `drizzle-kit push`. One more trap is a new enum value: Drizzle applies all new migrations **in one transaction**, and an enum value cannot be used in the transaction that added it. That is why stage 4 did without a new `food_source` value.

### Food seed
- `db/seed/sources/usda.json` (209 foods) and `label.json` (13) are the sources with translated names and portions.
- `pnpm seed:build <USDA SR Legacy CSV directory>` builds `db/seed/foods.json` from them. The USDA archive sits in `.cache/`, outside git.
- `pnpm db:seed` upserts by `seed_key`, so re-running is safe. Keys that disappeared get `deleted_at`; for changed foods, users' dishes are recomputed.

## Tests
Vitest with two projects (`vitest.config.ts`):

| Project | Files | Notes |
| --- | --- | --- |
| `unit` | `**/*.test.ts` | no database or network, parallel |
| `db` | `**/*.db.test.ts` | `tests/global-setup.ts` migrates `bitewise_test`; files run one at a time (`fileParallelism: false`); `resetDb()` runs `TRUNCATE users CASCADE` before every test |

- `pnpm test` runs everything, `pnpm test:unit` only unit tests, `pnpm vitest run lib/recipes` a selection.
- Helpers: `tests/db.ts` (`testDb`, `resetDb`, `closeTestDb`, `createTestPool` for race tests), `tests/foods.ts` (`newUserId`, `insertSharedFood`, `insertSharedPortion`, `createOwnFood`), `tests/recipes.ts` (`insertRecipeFood`).
- Calculations are written test-first: a test with hand-computed numbers, then the code (`.claude/rules/testing.md`). Tests must not be weakened to make them pass.
- External APIs (USDA, Open Food Facts, AI) only through fixtures in `tests/fixtures/`, without the network.

## Lint and format
- `pnpm lint` = ESLint → `next typegen` (route types; `tsc` fails without them) → `tsc --noEmit`. TypeScript: `strict` + `noUncheckedIndexedAccess`.
- A Claude Code hook runs Prettier after every edit of ts/tsx/md/json; by hand, `pnpm format`. Prettier skips `docs/`, `.claude/` and `CLAUDE.md`: `docs/ru/` are Obsidian notes.

## CI
`.github/workflows/ci.yml` on every push and PR: Postgres 17 as a service → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test`. A full run takes about a minute. Merging into `master` only on green CI.

## Common issues
- **A form or search shows old values after returning to a screen.** `cacheComponents` keeps hidden screens alive with their state. A client form on such a screen needs a `key` from its input data or the `ResetOnHide` wrapper (`components/ui/reset-on-hide.tsx`). See `.claude/rules/ui.md`.
- **The session and cookies are read only inside `<Suspense>`.** Every page is `Page` → `<Suspense fallback={<PageLoading />}>` → `…Content`, and `requireUserId()` is called inside `…Content`.
- **Locally `pnpm test` sometimes takes 15–30 minutes with almost no CPU.** Not the code: CI runs the same code in under a minute. It is the environment (Podman or macOS with the process in the background); a re-run in the foreground usually takes 10–20 seconds. Under heavy machine load the scrypt tests can time out; they pass on their own.
- **The full production stack on a laptop** (nginx, TLS, the database role, release and rollback): the "Run on a laptop" section in [deploy.md](deploy.md).
- **`next dev` rewrites `AGENTS.md`.** It is a block of Next.js rules for agents and can be committed as is.
