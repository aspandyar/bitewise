# Project: Bitewise

**English** · [Русский](../ru/PROJECT_PLAN.md)

Related: [features](features.md) · [architecture](architecture.md) · [decision log (Russian)](../ru/notes.md)

## Goal
Log what you ate quickly and honestly, and see what is left of your calorie and macro target. Logging one meal takes no more than 15 seconds.

Principle: **numbers come from the food database and a formula, never from a neural network.** AI speeds up input (photos, free text), but the result is always computed as `Σ grams × kcal_per_100g / 100` and confirmed by the user.

---

## Current status
Stages 0–5 and 6a are done, 6b without a server: production is built and tested on a laptop. **Next step**: the first `/deploy` once there is a server and a domain (#8); then v0.2, starting with barcodes (`ft/barcode`).

- **Skeleton** (`ft/karkas`): Next.js, TypeScript strict, Tailwind, Postgres in Docker, Drizzle, Vitest, CI.
- **Sign-in, profile, target** (`ft/auth-profile`): Auth.js v4 (email + password, JWT), roles user/manager/admin (the admin comes from `pnpm admin:bootstrap`), onboarding, kcal/macro target automatic or manual.
- **Foods** (`ft/foods`): own foods and portions, search from 1–2 letters and with typos, a seed of 222 foods.
- **Diary** (`ft/diary`): the day on the home screen, meals, entries in grams or portions with a snapshot of the food, totals and progress to the target, days in the user's time zone.
- **Dishes** (`ft/recipes`): a dish made of foods, cooked weight and servings → kcal per 100 g and "1 serving", recomputed when ingredients change, logged like a food.
- **Polish 1–5** (PRs #77, #79, #80, #84, #85).
- **Fast input** (`ft/quick`): favorites, recent foods in 2 taps with Undo, "Repeat" a meal, "just N kcal", "Today / Yesterday".
- **Look and PWA** (`ft/pwa`, 6a): theme and accent color, manifest and icons, a service worker with an offline page, "Install on your phone".
- **Production in the repository** (`ft/deploy`, 6b): the image, `docker-compose.prod.yml` with nginx, TLS and certbot, release with backup and rollback, cron backups and restore checks, the image built into GHCR on demand, CSP; runbook: [deploy.md](deploy.md).
- **Production before the first deploy** (`ft/hardening`, #101–#104): the app's own Postgres role, secrets per container, a read-only `app`, images pinned by digest.
- **Retries without duplicates** (`ft/retry-safe`, #95): a request key on every form.
- **Polish 6** (`ft/polish-6`): logs without SQL parameters, replays under another account, forms, appearance, PWA (#76, #81–#83, #86–#93, #96–#99, #107).
- **Security** (`ft/security`): closed sign-up, session revocation and password change, device mark, write cap, `server-only`, removing unused deleted foods for good (#28–#32, #108; #27 needs email confirmation or a captcha before sign-up opens).
- **Documentation** (`ft/docs`): a README for GitHub, docs in Russian (`docs/ru/`) and English (`docs/en/`).

---

## Stages (branch order = build order)

### MVP — "a diary you can use every day"
| # | Branch | What to build | Done when |
| --- | --- | --- | --- |
| 0 | `ft/karkas` | Next.js + TS strict + Tailwind v4 + Vitest + ESLint; Drizzle + Postgres in `docker compose`; `lib/config.ts`; CI (lint + test) | `docker compose up -d db && pnpm db:migrate && pnpm dev` serves an empty home page; `pnpm lint` and `pnpm test` are green |
| 1 | `ft/auth-profile` | sign-up/sign-in; profile (sex, birth date, height, weight, activity, goal); target calculation | after onboarding the kcal/macro target is shown and can be overridden |
| 2 | `ft/foods` | foods table (per 100 g), CRUD for own foods, portions ("1 piece = 60 g"), search (`pg_trgm`), seed of base foods | "гречка" (buckwheat) is found from 1–2 letters, an own food is added |
| 3 | `ft/diary` | day → meals (breakfast/lunch/dinner/snack) → "food × grams" entries; totals and progress bars | an entry is added/edited/deleted and the totals follow |
| 4 | `ft/recipes` | own dishes from ingredients; cooked weight → kcal per 100 g and per serving | a borscht of 8 ingredients is logged as one food |
| 5 | `ft/quick` | favorites, recent foods, "repeat yesterday's breakfast", "just N kcal" | a typical breakfast takes 2 taps |
| 6a | `ft/pwa` | manifest + service worker (offline page), icons, `useOffline` banner, "Install on your phone"; "System / Light / Dark" theme and accent color (cookie + a `<head>` script, no flash, `theme-color` per theme), the Appearance screen | theme and accent switch and are remembered; the production build installs as an app and has its own offline page |
| 6b | `ft/deploy` | Dockerfile, nginx + TLS on a VPS, `pg_dump` backups by cron; #17–#26 (bootstrap and seed on deploy, nginx headers and CSP, `NEXTAUTH_*` at build time, scrypt semaphore, database locale) | the app is on the phone and lives on its own domain |

### v0.2 — "comfort and body"
| # | Branch | What to build |
| --- | --- | --- |
| 7 | `ft/barcode` | a camera barcode scanner → Open Food Facts → cached in our database |
| 8 | `ft/body` | water, body weight, charts, weekly kcal/macro averages, history |

### v0.3 — "AI input"
| # | Branch | What to build |
| --- | --- | --- |
| 9 | `ft/ai-core` | provider interface (OpenAI / Anthropic via config), zod response schemas, limits and a request log with cost |
| 10 | `ft/ai-text` | "2 eggs, toast with butter, coffee with milk" → confirmation card → entries |
| 11 | `ft/ai-photo` | a photo of a plate → "food + grams + confidence" list → confirmation card |
| 12 | `ft/ai-chat` | a short chat to correct the recognition: "there were 8, not 6" |

### Later (see [features](features.md), Tier 4)
Dishes that fit the remaining target, a shopping list, a weekly meal plan, reminders, CSV/Markdown export.

---

## Working rules
- One branch = one stage, merged into `master` after green CI.
- After each stage, update "Current status" and record decisions in the [decision log](../ru/notes.md).
- Don't start v0.3 until the MVP has lived on a phone for at least a week: AI should speed up a working diary, not replace it.
