# Bitewise — architecture

**English** · [Русский](../ru/architecture.md)

Related: [project plan](PROJECT_PLAN.md) · [features](features.md) · [decision log (Russian)](../ru/notes.md)

## Stack
| Layer | Choice | Why |
| --- | --- | --- |
| Front + back end | **Next.js** (App Router), React, **TypeScript strict** | one language, server code is the backend, AI keys never reach the browser |
| UI | Tailwind v4, own components (`components/ui`) | fast, mobile layout, no extra dependencies |
| Database | **Postgres** | reliable, `pg_trgm` for typo-tolerant search |
| ORM / migrations | Drizzle ORM + drizzle-kit | types from the schema, SQL-like syntax |
| Validation | zod | one schema for forms, APIs and AI responses |
| Auth | **Auth.js v4**, Credentials + JWT (30 days), scrypt passwords from `node:crypto` | email + password; Auth.js Credentials only works with JWT |
| PWA | manifest + service worker, `experimental.useOffline` | install on a phone, an offline page, actions retried after a dropped connection |
| Tests | Vitest: a `unit` project and a `db` project on a separate `bitewise_test` database; the UI is checked by the ui-checker subagent in a browser | calculations and queries automatically, layout by eye |
| Deployment | Docker Compose on a VPS: `db`, `app`, `nginx` (TLS), `certbot`; the image comes from GHCR (dev compose has only `db`) | own server, a familiar stack |
| Backups | `pg_dump` by cron on the server, 14 days, a monthly restore check | |

## Principles
> **The main rule.** Calories and macros are computed **only by `lib/nutrition.ts`**: pure functions with tests. AI only returns a structure of "what and how many grams".

- All constants (activity factors, fat %, AI limits, models) live in one `lib/config.ts`.
- `db/client.ts` and `lib/env.ts` are marked `server-only`: importing the database or secrets into a client component fails the build (#32). Scripts (seed, admin, migrations, drizzle-kit) go through `db/connect.ts` and `lib/env-read.ts`.
- **A nutrient snapshot in each diary entry:** on adding, the food's name and per-100 g values are copied, and the entry's totals are computed by code. Editing a food never changes past days.
- The origin of each entry (`manual | barcode | ai_text | ai_photo | quick`) will become a `source` column with a default in later stages.
- A dish is also a `foods` row: search, portions and the diary treat it as a food, and its per-100 g numbers are recomputed from its ingredients.

## Data model
Built: the tables up to and including `favorites`; below the line is the plan.

| Table | Main fields |
| --- | --- |
| `users` | id (uuid), email (unique, lowercased), password_hash (scrypt), role (`user/manager/admin`, default `user`; admin only via the bootstrap script), client_request_id? (the sign-up form's request key, globally unique via a partial index; a replayed sign-up finds the account it made, #107), token_version integer (0; a password change and "sign out everywhere" bump it, and sessions with an older version stop working, #29), created_at |
| `profiles` | user_id (pk → users, cascade), sex, birth_date, height_cm numeric(5,1), weight_kg numeric(5,1), activity_level, goal, updated_at |
| `targets` | id, user_id (→ users, cascade, index), name ("По умолчанию", "Default"), mode (`auto/manual`), kcal, protein_g, fat_g, carbs_g numeric(8,2), is_default (a partial unique index: one default target per user), created_at, updated_at |
| `foods` | id, owner_id (→ users, cascade, index; null = shared: from the seed or from Open Food Facts), name, search_name (generated: `replace(lower(name), 'ё', 'е')`, GIN `gin_trgm_ops`), kcal_100, protein_100, fat_100, carbs_100 (net of fiber), fiber_100? numeric(8,2), source (`user/usda/label/off`; later `ai_estimate`), seed_key (unique: `usda:<fdcId>` / `label:<slug>` / `off:<barcode>`; the seed retires only its own sources `usda/label`), barcode? (normalized GTIN: UPC-A and zero-led GTIN-14 stored as EAN-13; one per code among shared foods and one per code for each owner, a deleted food frees its code; CHECK: 8–14 digits), source_url?, copied_from? (`food_source`: where an own food was copied from, only with `source = user`), deleted_at (soft delete, only while diary entries or ingredients point at the food; without references the row is removed for good, #108), created_at, updated_at. CHECKs: `source = user` ⇔ has an owner ⇔ no seed_key; nutrients ≥ 0; source_url only `https://`; copied_from only on own foods and never `user` (a copy of an own food gets null, #87) (the page also renders the link through `safeSourceUrl`) |
| `food_portions` | id, food_id (→ foods, cascade, index), user_id (→ users, cascade, index; null = shared, from the seed), label ("1 piece"), grams numeric(8,2) > 0, created_at |
| `recipes` | id, user_id (→ users, cascade, index), food_id (→ foods, cascade, unique: the dish itself is a `foods` row with its name, per-100 g numbers and soft delete), cooked_weight_g numeric(8,2)? > 0 (null = by raw weight), servings integer? > 0 (1–100 in the form), created_at, updated_at. `calcRecipe` computes the per-100 g numbers and `lib/recipes/recompute.ts` writes them to the `foods` row whenever the dish, an own ingredient food or the seed changes; "1 serving" is the dish row's only `food_portion` (0.1–5000 g, else none). No dishes inside dishes |
| `recipe_items` | id, recipe_id (→ recipes, cascade, index), user_id (→ users, cascade, index), food_id (→ foods, no cascade, index: finds dishes to recompute), grams numeric(8,2) > 0, portion snapshot portion_label, portion_grams, portion_count (all null or all set), created_at. Deleting a dish deletes its ingredients |
| `diary_entries` | id, user_id (→ users, cascade), date (the user's local date), meal (`breakfast/lunch/dinner/snack`), food_id? (→ foods, no cascade: foods are soft-deleted; null = a "just N kcal" entry stored as 100 g × the typed per-100 g numbers, without a portion, by CHECK), snapshot: food_name, kcal_100, protein_100, fat_100, carbs_100 numeric(8,2); grams > 0; portion snapshot portion_label, portion_grams, portion_count (all null or all set); created_at, updated_at. Indexes `(user_id, date)`, `(user_id, created_at DESC, id DESC)` for recent foods (#93), and `food_id`. Totals come from `lib/nutrition.ts`; a dish is logged like a food (the dish row's `food_id`) |
| `water_entries` | id, user_id (→ users, cascade), date (local date), ml integer > 0, client_request_id?, created_at. One row per tap of "+250 / +500" (only `WATER.quickMl`); "Remove last" deletes a row by id, so a replay removes nothing more. Index `(user_id, date)`, capped by `WATER.maxEntriesPerDay` a day |
| `weight_entries` | id, user_id (→ users, cascade), date, weight_kg numeric(5,1) > 0, created_at, updated_at. One weigh-in a day: unique `(user_id, date)`, also the upsert target. The newest weigh-in is copied into `profiles.weight_kg` and recalculates an auto target (`saveProfile`; a manual one is left alone); deleting it falls back to the next newest |
| `weight_save_requests` | user_id (→ users, cascade), client_request_id, created_at; PK `(user_id, client_request_id)`. Keys (#95) of weigh-in saves and edits already applied (#132): a replay with such a key writes nothing; otherwise the old value would land over the new one. The weigh-in row cannot hold the key, since every save overwrites it. Keys older than `WEIGHT.requestKeyDays` are deleted in the save's transaction |
| shared by `diary_entries`, `foods`, `food_portions`, `recipes`, `recipe_items`, `water_entries` | client_request_id uuid?: the request key the client created the row with; unique per owner (`(user_id or owner_id, client_request_id)`, a partial index `WHERE client_request_id IS NOT NULL`). A replay of the same request finds the row already made (#95) |
| `favorites` | user_id (→ users, cascade), food_id (→ foods, cascade, index), created_at; primary key `(user_id, food_id)`. A star on a food or dish; on the "+ Add" screen above recent foods; capped by `QUICK.maxFavorites` |
| — planned — | |
| `day_settings` | user_id, date, target_id |
| `ai_requests` | id, user_id, kind (`text/photo/chat`), provider, model, tokens_in, tokens_out, cost_usd, status, created_at |

## Layers and the request flow
```text
page (Server Component, under <Suspense>)          app/**/page.tsx
  │  requireUserId() → read through a repo → lib/nutrition.ts on the server
  ▼
client form ("use client")                          components/**
  │  usePreservingFormAction → server action
  ▼
server action                                       app/**/actions.ts
  │  session → parseId → zod schema → repo → redirect / FormState with field errors
  ▼
repo (every query filters by user_id)               lib/<area>/repo.ts
  │  Drizzle; transactions and locks for caps and recomputation
  ▼
Postgres 17 (+ pg_trgm)                             db/schema.ts → db/migrations
```
- Pure logic is kept apart from I/O: `lib/nutrition.ts`, `lib/date.ts`, `lib/format.ts`, zod schemas, `handleFoodSearch`. Unit tests cover it; db tests cover the repos.
- `cacheComponents` keeps hidden screens alive. So forms get a `key` from their data or a `ResetOnHide` wrapper, and the delete button disarms when the screen is left.
- "Today" follows the browser's time zone: `TimeZoneCookie` sets the `tz` cookie, the fallback is `Asia/Almaty`.
- **Theme and accent color** live in the `bw-theme` and `bw-accent` cookies on the device. The root layout does not read them (under `cacheComponents` that would make every screen request-time): an inline `<head>` script (`appearanceScript`) sets `data-theme` / `data-accent` on `<html>` before the first paint and, for a forced theme, adds its own `theme-color` first (the server metas are left alone: React matches them by `content` while hydrating and would add a rewritten one again; after hydration `syncThemeColor` removes the early meta). `appearanceCss` builds the theme CSS variables from `APPEARANCE` in `lib/config.ts`. Classes are `bg-accent`, `text-on-accent`, `text-accent-text`; the `dark:` variant follows both the choice and the system. The browser writes the choice itself (`appearanceCookies`, `Secure` by the page's protocol), with no server action, so no late server answer can re-render the screen with an older choice (#97); "Saved" is a `showToast` without navigation.
- **PWA.** `/manifest.webmanifest` (`app/manifest.ts`); `next/og` draws the icons `/icon`, `/apple-icon`, `/pwa-icons/*` at build time. The service worker `/sw.js` (from `lib/pwa/service-worker.ts`) touches only navigations (offline it serves `/offline`) and its own icons (offline from the cache). The cache name is `bitewise-<hash>` of the offline page and icon settings, so a new offline page reaches installed copies with no manual version; precaching uses `cache: "reload"` (#96). In dev a leftover worker is unregistered (#98). A connection dropped mid-use is handled by `experimental.useOffline`: navigations and server actions wait for the network and retry; the banner is `OfflineBanner`.
- **Retries without duplicates (#95).** `useOffline` retries a server action when its `fetch` failed, even if the first request reached the server and ran. So every submit carries its own `requestId` key (`stampRequestId` in `usePreservingFormAction` and `KeyedForm`); a retry sends the same FormData and key, a new tap a new one. Creating repo functions, under the user's write lock (or the dish row's lock for ingredients), first look for a row with that key and return it, otherwise insert with the key. The star sends the state it should end in (`setFavoriteAction`), not "toggle". A key already used for another target (another day, meal, food or dish) is refused as a forged request. A delete that finds nothing lands where a successful one does (without the "deleted" toast), for a foreign or unknown id too, so no object's existence is revealed. The key is set by client code, so quick "+" and "Copy" need JS: a server-rendered key would repeat from the `cacheComponents` cache and swallow a second real tap. Without `crypto.randomUUID` (http on a LAN address) the form goes without a key. Leftovers (#107): next to the key the form carries the signed-in user's id (`requestUser`) from the `bw-uid` cookie (`__Host-bw-uid` over https, so a sibling or parent domain cannot plant it), set by the latest rendered page (`RequestUserMark`) and shared by tabs; form actions (and "Reset target") get the user through `requireActionUser` and write nothing for another user's id, landing on the home screen with a "nothing was saved" toast. A replay after signing in as someone else carries the old id and is refused, while a fresh submit from an old tab carries the new one. Sign-up sets a key too: a replay finds the account it made and signs in with a normal `signIn`. "Repeat" puts the key and keys derived from it (`sha256(key:i)`) on the batch, so a replay answers with the same entries and the "added" toast with Undo.
- **Logs without data (#76).** `instrumentation.ts` wraps `console.error` / `console.warn`: every argument goes through `loggableError`. A failed drizzle query (recognized by class or by shape, since the production build carries several copies of the class), also inside `cause` and `AggregateError`, a raw Postgres error (its `detail` can echo a value), and a string with `Failed query:` become the error name and SQLSTATE, without SQL or parameters; a chain deeper than `LOG_SCRUB.maxDepth` is reduced to its name; the `digest` Next shows the user is kept. `bootstrap-admin` logs through the same `loggableError`.

## Production
- A separate VPS, `docker-compose.prod.yml` (project `bitewise-prod`): `db` and `app` without published ports, `nginx` (TLS, HSTS, gzip, `limit_req` on sign-in and sign-up, 503 + `Retry-After` during a restart), `certbot` (renewal).
- The image is Next standalone + `ops/*.js` (esbuild: the drizzle-orm migrator with database checks, the seed, the admin). GitHub Actions builds it into GHCR on demand; the server only pulls.
- Release: `docker/scripts/release.sh <sha> <digest>`: backup → the app's database role → migrations → seed → admin → new container → `/api/health`; on failure, rollback to the previous image. The image is pulled by the digest from the build artifact and its commit label is checked; base images are pinned by digest too.
- Rights in production: the app uses its own Postgres role without superuser (only rows of its tables), migrations run as the owner; every container gets only its own variables; `app` is read-only, with no capabilities.
- Headers: `lib/security-headers.ts` (CSP with `'unsafe-inline'` for Next's scripts, `Permissions-Policy`); HSTS in nginx.
- Details: [deploy.md](deploy.md).

## Security (in short)
- **Sessions and passwords.** The session is an Auth.js JWT. Every session read checks `token_version` and the role against the database (`checkToken`, one primary-key lookup): after a password change or "sign out everywhere" old tokens stop working, and the role is not a snapshot from sign-in (#29). Passwords are scrypt (N = 2^15). An unknown email still pays for a dummy hash, so response time reveals nothing. Changing the password requires the current one, 5 attempts per 15 minutes per account and token version (after "sign out everywhere" the owner gets a fresh budget); the device then signs in again with the new password. Neither the password change nor "sign out everywhere" is subject to the write cap, so a thief with a stolen session cannot block their own revocation. The admin's password is not changed in the app: it comes from `ADMIN_PASSWORD`, which bootstrap would restore on deploy.
- **Sign-up** is closed until `REGISTRATION=open` opens it (#27): the page and `registerAction` answer "sign-up is closed" before doing any work.
- **Device mark (#30).** After sign-in the browser gets an httpOnly `bw-device` cookie (`__Host-` over https) for a year: an HMAC of the user id, token version and issue time with `NEXTAUTH_SECRET`. A password change and "sign out everywhere" revoke all marks. Sign-in attempts with a mark count in the account's shared trusted-device bucket, separate from strangers': wrong passwords from elsewhere do not lock the owner out, and minting more marks buys no extra attempts.
- **In-memory rate limits** (fail-closed, up to 100k keys): sign-in 10 per 15 minutes, sign-up 5 per hour per IP, search 120 per minute, any write (server actions via `requireActionUser` / `requireWriteUser`) 60 per minute per user (#31), password change 5 per 15 minutes. Outside, nginx `limit_req`. Password hashing: at most 2 at once, a queue of up to 20 (a semaphore).
- **Roles.** New accounts are always `user`. `admin` appears only via `pnpm admin:bootstrap`; privileged actions read the role from the database.
- **Access.** Every repo query is limited to the session's `user_id`. Someone else's object → 404.
- **Volume caps:** 1000 own foods and dishes, 20 portions per food, 50 ingredients per dish, 100 diary entries per day and 100,000 per account.
- **Secrets** only in the server's env, validated by zod at start (`lib/env-read.ts` through `lib/env.ts`).

## Target calculation
```text
BMR (male)   = 10 × weight_kg + 6.25 × height_cm − 5 × age + 5
BMR (female) = 10 × weight_kg + 6.25 × height_cm − 5 × age − 161
TDEE         = BMR × activity (1.2 … 1.9)
Target kcal  = TDEE × (1 + goal adjustment)     # −15 % / 0 / +10 %, all in config
Protein      = weight_kg × g/kg (1.6–2.0)
Fat          = target × 25–30 % / 9
Carbs        = (target − protein×4 − fat×9) / 4
```

## Food data sources
| Source | What it gives | Notes |
| --- | --- | --- |
| Own foods | everything the user typed | the main source |
| Seed set | 222 base foods in Russian: 209 from USDA SR Legacy (translated names, portions from `food_portion.csv`) + 13 from product labels (VkusVill pages) | `db/seed/sources/*.json` → `pnpm seed:build` → `db/seed/foods.json` → `pnpm db:seed` |
| **Open Food Facts** (stage 7) | barcodes, packaged products, covers CIS countries | by scanned code only; what is found is saved as a shared food with `source = 'off'`; incomplete data is not saved; ODbL attribution at the bottom of "Продукты" and on the card |
| **USDA FoodData Central** | raw ingredients, precise data | English names; free API key |

### Barcode lookup
```text
camera (barcode-detector, zxing-wasm served by our site) or typed digits
   │  checkBarcode: spaces, hyphens and invisible characters dropped; digits, length, check digit
   │  (a typo gets its own message); UPC-A and GTIN-14 → EAN-13, a zero-padded EAN-8 → 8 digits
   ▼
GET /api/foods/barcode?code=[&typed=1]  (session, 30/min per user)
   │  typed=1 means typed digits: 8 of them are looked up as an EAN-8 and, if neither we nor
   │  OFF know it, also as a UPC-E (expanded to UPC-A); the camera knows the format, so its
   │  code is looked up as it is
   │
   ├─ the user's own food with this code ───────┐
   ├─ a shared one (incl. one found in OFF) ────┤→ found → amount screen / food card
   └─ Open Food Facts (7/min per process, 3/min per user, 4 s timeout)
        ├─ all numbers present → shared `off` food (+ a "1 шт" portion) → found
        ├─ incomplete / unknown → not_found + hints → own-food form with the barcode
        └─ no answer → unavailable → "create it yourself" or "scan again"
```
Kcal are never derived from the macros; kJ → kcal by dividing by 4.184; per-serving values become per-100 g only with a known serving weight; 100 ml = 100 g. Parsing is `lib/foods/off.ts`, orchestration `lib/foods/barcode-lookup.ts`, saving `lib/foods/barcode-repo.ts` (an advisory lock per code against two racing scans).

## AI pipeline (v0.3)
```text
photo / text
   │
   ▼
FoodRecognizer (interface)          ← OpenAI | Anthropic, chosen by env AI_PROVIDER / AI_MODEL
   │  the response strictly follows a zod schema:
   │  [{ name, grams, confidence 0..1, note }]
   ▼
matching against the database       ← no match → a per-100 g estimate from AI, marked ai_estimate
   ▼
confirmation card in the UI         ← edit grams / replace a food / delete a line
   ▼
lib/nutrition.ts → diary_entries    ← numbers come from code, not the model
```
- The photo is resized on the client to ~1024 px; not stored by default.
- Limits: N requests per day per user, a cost log in `ai_requests`.
- Keys only in the server's env, never on the client.
- Correction chat: edit history + the current list of items → the model returns a **new list**, not free text.

## Repository layout
```text
bitewise/
├── app/
│   ├── (auth)/          # login, register (+ actions)
│   ├── (app)/           # home diary, onboarding, profile, targets, foods/**, diary/**, recipes/**, body/** (weight), stats + actions.ts
│   ├── api/             # foods/search, health, auth/[...nextauth]
│   └── manifest.ts, icon.tsx, apple-icon.tsx, pwa-icons/, sw.js/, offline/   # PWA
├── components/          # ui/ (forms, two-tap delete, ResetOnHide, offline banner), auth/, diary/, foods/, recipes/, profile/, targets/, water/, body/, stats/, pwa/, brand/
├── lib/
│   ├── config.ts        # all constants and caps
│   ├── nutrition.ts     # all calculations (+ tests), day and period totals included
│   ├── body.ts, chart.ts  # 7-day weight average; SVG chart scales
│   ├── amount.ts        # amounts: grams or portion × N (diary and dish ingredients)
│   ├── date.ts, format.ts, forms.ts, ids.ts, i18n/ru.ts
│   ├── env.ts, env-read.ts  # environment variables: for the app (server-only) and for scripts
│   ├── log.ts, request-id.ts, toast.ts   # log scrubbing, request key, toasts
│   ├── appearance.ts    # theme and accent: palette → CSS, the <head> script, contrast
│   ├── pwa/             # icons, service worker, offline page, install hint
│   ├── auth/            # Auth.js, passwords, rate limits, sign-up, roles, token version, device mark
│   ├── foods/ diary/ recipes/ profile/ targets/ users/ water/ weight/ stats/   # repo.ts · schema.ts · types.ts (+ tests)
│   └── ai/              # stages 9–12
├── db/                  # schema.ts, migrations/, seed/ (foods.json + sources/), client.ts (server-only), connect.ts (scripts), ops/ (the image's migrator)
├── scripts/             # build-food-seed.ts, bootstrap-admin.ts
├── docker/              # postgres init, nginx template, release and backup scripts, crontab
├── Dockerfile, docker-compose.prod.yml   # production image and stack
├── instrumentation.ts   # at start: log scrubbing, REGISTRATION check
├── tests/               # testDb, helpers, global-setup, fixtures
├── docs/                # ru/ — docs in Russian (+ superpowers/: stage specs and plans), en/ — in English
└── .claude/             # rules, skills, agents, settings
```
