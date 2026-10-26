# Project: Bitewise

**English** · [Русский](../ru/PROJECT_PLAN.md)

Related: [features](features.md) · [architecture](architecture.md) · [decision log (Russian)](../ru/notes.md)

## Goal
Log what you ate quickly and honestly, and see what is left of your calorie and macro target. Logging one meal takes no more than 15 seconds.

Principle: **numbers come from the food database and a formula, never from a neural network.** AI speeds up input (photos, free text), but the result is always computed as `Σ grams × kcal_per_100g / 100` and confirmed by the user.

---

## Current status
Stages 0–5 and 6a are done, 6b without a server: production is built and tested on a laptop. v0.2 is done and released as `v0.2.0`, with the scanner fix as `v0.2.1` (a pre-release until deployed): the barcode scanner (stage 7), water, weight and statistics (stage 8). **Next step**: the first `/deploy` once there is a server (the domain is `aspandyar.org`, #8); then AI input (`ft/ai-core`).

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
- **Barcode scanner** (`ft/barcode`, stage 7): the iPhone or Android camera, or typed digits → an own food, a shared one or Open Food Facts (what is found is saved as a shared food) → the amount screen; not found → an own food with the barcode.
- **Water, weight, statistics** (`ft/body`, stage 8): water +250 / +500 on the home screen, weight with a chart and a 7-day average (a fresh weigh-in updates the profile and the auto target), statistics for a week and a month: averages, "days on target", kcal by day.
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

### v0.3 — "AI input: text"
| # | Branch | What to build |
| --- | --- | --- |
| 9 | `ft/ai-core` | provider interface (OpenAI / Anthropic via config), zod response schemas, limits and a request log with cost |
| 10 | `ft/ai-text` | "2 eggs, toast with butter, coffee with milk" → confirmation card → entries |

### v0.4 — "AI input: photo and chat"
| # | Branch | What to build |
| --- | --- | --- |
| 11 | `ft/ai-photo` | a photo of a plate → "food + grams + confidence" list → confirmation card |
| 12 | `ft/ai-chat` | a short chat to correct the recognition: "there were 8, not 6" |

### Later (see [features](features.md), Tier 4)
Dishes that fit the remaining target, a shopping list, a weekly meal plan, reminders, CSV/Markdown export.

## Releases
A GitHub tag marks a plan milestone; the version in `package.json` matches the tag. Until a version is on the server, it is a pre-release.

| Version | What's in it | When |
| --- | --- | --- |
| `v0.1.0` | MVP: stages 0–6, security, docs | released 2026-10-22 |
| `v0.2.0` | stages 7–8: barcode scanner, water, weight, statistics; fixes #121–#123 | released 2026-10-26 |
| `v0.2.1` | scanner: barcode lookup works in the browser again (`fetch` called without `window`) | released 2026-10-26 |
| `v0.2.x` | fixes and updates that need to reach the server between milestones (#131, #132, security updates) | as needed |
| `v0.3.0` | stages 9–10: AI core and text input | after `ft/ai-text` |
| `v0.4.0` | stages 11–12: photo and the correction chat | after `ft/ai-chat` |
| `v1.0.0` | no new features: the app runs on its own domain, AI input is stable, a backup restore is checked, 2+ weeks of daily use without blocking bugs | after `v0.4.0` and the deploy |
| `v1.x` | Tier 4, one minor version per feature (#117 CSV export, #120 reminders, …) | later |

How a release is cut:
1. A PR bumps the version in `package.json` and "Current status".
2. The owner merges it.
3. The tag goes on that merge commit; `gh release create vX.Y.Z --prerelease`, notes in English.
4. After `/deploy`: `gh release edit vX.Y.Z --prerelease=false`, and the release becomes "Latest".

The image is built by hand from `master` (`release.yml`); a tag does not trigger a build: rollback on the server goes by the image tag `<sha>` in GHCR.

---

## Working rules
- One branch = one stage, merged into `master` after green CI.
- After each stage, update "Current status" and record decisions in the [decision log](../ru/notes.md).
- Don't start v0.3 until the MVP has lived on a phone for at least a week: AI should speed up a working diary, not replace it.
