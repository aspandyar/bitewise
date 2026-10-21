# Bitewise

**English** · [Русский](README.ru.md)

A food diary for your phone: log a meal in under 15 seconds and see honestly how many calories and macros are left for today.

<p>
  <img src="docs/images/day.png" alt="Day view: calories, macros and meals" width="200">
  <img src="docs/images/add.png" alt="Adding food: favorites and recent foods" width="200">
  <img src="docs/images/food.png" alt="Food card with portions" width="200">
  <img src="docs/images/day-dark.png" alt="Day view in the dark theme" width="200">
</p>

## Why

Most calorie counters are either slow (five screens per entry) or "smart" and imprecise, with numbers made up by a neural network. Bitewise keeps one rule: **numbers come from the food database and a formula, never from AI.** All calories and macros are computed by one tested module, foods are stored per 100 g, and each diary entry keeps a snapshot of the numbers at the time it was logged, so editing a food later never rewrites past days. AI will come later only to speed up input ("an omelette of three eggs" → items to confirm), never to write numbers itself.

## What it does today

- **Targets.** A profile (sex, age, height, weight, activity, goal) → a calorie target by the Mifflin-St Jeor formula plus macros; or set your own.
- **Diary.** Breakfast, lunch, dinner, snack; a food in grams or portions ("1 piece = 60 g"); day totals and progress to the target; day navigation in the phone's time zone.
- **Fast input.** Favorites and recent foods in one tap, with Undo; "Repeat" your last breakfast; "just 450 kcal" without a food.
- **Foods.** 222 base foods (USDA, translated, plus product labels), search from the first letter and with typos, your own foods and portions, copying a shared food to your own.
- **Your dishes.** A borscht of eight ingredients with the cooked weight → kcal per 100 g and per serving; it goes into the diary like any food.
- **A phone app.** Installs to the home screen (PWA), dark theme and your own accent color, a clear screen offline, and actions retry by themselves once the network is back.
- **Security.** Everyone sees only their own data; password change and "sign out everywhere"; rate limits on sign-in and writes; logs without personal data.

The interface is in Russian.

## Status

Stages 0–5 and 6a are done, plus several polish and security batches; stage 6b (production) is built without a server. The production setup (Docker Compose, nginx, TLS, backups, release with rollback) is built and tested locally; a server and a domain are not chosen yet, so there is no public address, and sign-up is closed by default.

Next: a barcode scanner (Open Food Facts), weight and water, then AI input by text and by photo. Details: [project plan](docs/en/PROJECT_PLAN.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Postgres 17 + `pg_trgm` · Drizzle ORM · zod · Auth.js · Vitest · Docker Compose + nginx on a self-hosted VPS.

## Run locally

You need Node 24+, pnpm and Docker (or Podman) for Postgres.

```bash
pnpm install
cp .env.example .env     # fill in NEXTAUTH_SECRET and ADMIN_PASSWORD
docker compose up -d --wait db
pnpm db:migrate && pnpm db:seed && pnpm admin:bootstrap
pnpm dev                 # http://localhost:3000, sign in as the admin
```

Sign-up opens with `REGISTRATION=open` in `.env`. Variables, tests and common issues: [development guide](docs/en/development.md).

## Documentation

|                                            |                                                 |
| ------------------------------------------ | ----------------------------------------------- |
| [Plan and status](docs/en/PROJECT_PLAN.md) | stages and what is done                         |
| [Features](docs/en/features.md)            | what the app does and what is planned           |
| [Architecture](docs/en/architecture.md)    | layers, data model, calculations, security      |
| [API](docs/en/api.md)                      | HTTP routes and server actions                  |
| [Development](docs/en/development.md)      | local setup, tests, migrations, CI              |
| [Deployment](docs/en/deploy.md)            | production on a VPS: release, rollback, backups |
| [How we work](docs/en/workflow.md)         | stages, Claude Code, reviews                    |

Index: [docs/en](docs/en/README.md). The decision log and the stage specs and plans are in Russian only: [docs/ru](docs/ru/README.md).

## How it is built

The project is written with Claude Code stage by stage: each stage gets a spec and a plan approved by the owner, code by TDD, reviews by subagents (project rules, security, the interface at 375 px), and only then a merge. Rules, skills and agents live in the repository (`CLAUDE.md`, `.claude/`); the process is described in [workflow](docs/en/workflow.md).

## License

No license has been chosen yet, so all rights are reserved by default.
