# Bitewise — API

**English** · [Русский](../ru/api.md)

Related: [architecture](architecture.md) · [development](development.md)

The app has two kinds of server entry points:
- **HTTP route handlers** in `app/api/**`. There are three: food search, a health check and Auth.js.
- **Server actions** (`"use server"` in `app/**/actions.ts`). Only the app's own interface calls them, through forms. They are not a public REST API: Next.js builds their POST requests with an internal action id.

## Why no Swagger / OpenAPI
- There is almost no public REST: search, the health check and Auth.js's own route.
- Describing server actions in OpenAPI makes no sense: they have no stable URL or format, and the client and server are built together.
- The contract is already in code: every input is checked by a zod schema (`lib/**/schema.ts`), and this document collects them in one place.

**When to add OpenAPI.** When an external client appears: a native app, a bot, integrations, or public AI endpoints in stages 9–12. Then the spec should be generated from the same zod schemas (`zod-to-openapi`), not written by hand.

## Rules for every entry point
- **The session check comes first:**
  - `requireActionUser(formData)` in actions with a form: without a session → `/login`; a form sent under another account (a replay after switching accounts) writes nothing and lands on the home screen with a toast (#107); the write cap is counted;
  - `requireWriteUser()` in actions without a form (deletes, Undo): the same, without the form check;
  - `requireAccountUser(formData)` for "Change password" and "Sign out everywhere": no write cap, so a thief with a stolen session cannot block their own revocation;
  - `getSessionUserId()` in route handlers: without a session → `401`.
- **The session** checks the token version and role against the database on every read (#29): after a password change or "sign out everywhere" old sessions stop working.
- **All input goes through zod.** Ids from the URL and bound arguments (`action.bind(null, id)`) are checked by `parseId`. A broken uuid gives 404, not a Postgres error.
- **Someone else's or a missing object → `404`** (`notFound()`), never `403`: the answer does not reveal that the object exists. A delete that finds nothing lands where a successful one does.
- **Request key (#95).** The client puts `requestId` (a uuid) and `requestUser` into every form (`stampRequestId`). A creating action replayed with the same key returns what it already made; a key used for another target is refused.
- **Form errors** come back as `FormState { fieldErrors?, formError?, ok? }` and are shown at the field. Neither details nor SQL leave the server; logs are scrubbed of query parameters (#76).
- **Rate limits** (in memory, `lib/auth/rate-limit.ts`; values in `RATE_LIMITS` in `lib/config.ts`):
  - sign-in: 10 attempts per 15 minutes per IP and per account; trusted devices (a mark set after sign-in) count in a separate account bucket (#30);
  - sign-up: 5 per hour per IP (and only with `REGISTRATION=open`);
  - food search: 120 requests per minute per user;
  - any action that writes: 60 per minute per user (#31);
  - password change: 5 attempts per 15 minutes per account.

## HTTP

### `GET /api/foods/search`
Food search for the `FoodSearch` client component. The logic is the pure function `handleFoodSearch` (`lib/foods/search-api.ts`); `route.ts` only wires it to the request.

| Parameter | Type | Rules |
| --- | --- | --- |
| `q` | string | trimmed, spaces collapsed, lowercased, `ё`→`е`; 1–50 characters (`foodQuerySchema`) |
| `exclude` | `"recipes"` (optional) | hides dishes, for picking ingredients; any other value → `400` |

Responses (always `Cache-Control: no-store`):

| Status | Body |
| --- | --- |
| 200 | `{ items: FoodListItem[] }`: up to 20, own above shared |
| 400 | `{ error: "bad_query" }` |
| 401 | `{ error: "unauthorized" }` |
| 429 | `{ error: "rate_limited" }` |
| 500 | `{ error: "server_error" }`: details only in the server log |

```ts
type FoodListItem = {
  id: string;
  name: string;
  kcal100: number; protein100: number; fat100: number; carbs100: number; // per 100 g, carbs net of fiber
  source: "user" | "usda" | "label";
  isOwn: boolean;    // computed on the server, owner_id never leaves it
  isRecipe: boolean; // a dish row (stage 4)
};
```

How it searches: under 3 characters, the start of any word (`LIKE` with `%`, `_`, `\` escaped); from 3 characters also `word_similarity` from `pg_trgm` (threshold 0.4). Shared and own foods are visible, deleted ones are not.

### `GET /api/health`
A liveness check for `release.sh` and monitoring: `select 1` against the database with the `HEALTH.timeoutMs` timeout. No session.

| Status | Body |
| --- | --- |
| 200 | `{ ok: true }` |
| 503 | `{ ok: false }`: no error text, hosts or versions |

### `GET|POST /api/auth/[...nextauth]`
Auth.js v4: the Credentials provider (email + password), a JWT session for 30 days. The only route without a session check, because it is the one that creates sessions. Passwords are hashed with scrypt (`lib/auth/password.ts`). An unknown email still pays for a dummy hash, so response time does not tell whether an address is registered.

## Server actions

| File | Action | Input (zod) | Result |
| --- | --- | --- | --- |
| `app/(auth)/register/actions.ts` | `registerAction(formData)` | `lib/auth/schema.ts` | `RegisterResult`; closed unless `REGISTRATION=open`; per-IP limit; the role is always `user`; a replay with the same key finds the account it made |
| `app/(auth)/login/actions.ts` | `rememberDeviceAction()` | — | after sign-in sets the httpOnly device mark for the current session's account (#30) |
| `app/(app)/actions.ts` | `saveProfileAction` | `makeProfileSchema(today)` | → `/` |
| | `saveManualTargetAction` | `targetsSchema` | → `/` |
| | `resetTargetAction(formData?)` | — | → `/` or `/onboarding` |
| | `changePasswordAction(formData)` | current password, new one (`passwordSchema`) | `{ ok, email }` or field errors; revokes every session; the admin's password only via `ADMIN_PASSWORD` |
| | `signOutEverywhereAction(formData?)` | — | revokes every session of the account; the client then signs out |
| `app/(app)/foods/actions.ts` | `createFoodAction` | `foodSchema` | → `/foods/[id]` (or the amount screen if started from the diary); cap of 1000 own |
| | `updateFoodAction(foodId)` | `foodSchema` | → `/foods/[id]`; someone else's food or a dish → 404 |
| | `deleteFoodAction(foodId)` | — | → `/foods`; a food without references is removed for good, with references softly (#108) |
| | `copyFoodAction(foodId, formData?)` | — | copies a shared food to your own → edit the copy (replacing the history entry) |
| | `addPortionAction(foodId)` | `portionSchema` | `{ ok }`; up to 20 own portions; on a dish → 404 |
| | `deletePortionAction(foodId, portionId)` | — | only your own portion; a dish's portion cannot be deleted |
| `app/(app)/diary/actions.ts` | `addEntryAction` | `date` (`parseDiaryDate`), `foodId`, `addEntryFormSchema` (meal + grams or portion × count) | → the day; 100 entries per day, 100,000 per account |
| | `updateEntryAction(entryId)` | `updateEntryFormSchema` | → the entry's day |
| | `deleteEntryAction(entryId, rawDate)` | — | → the entry's day |
| | `quickAddAction(foodId, date, meal, formData?)` | — | quick "+" from favorites or recent foods with the last amount → the day with an "Added" toast and Undo |
| | `repeatMealAction(date, meal, formData?)` | — | copies the last filled meal of the same kind → the day; a replay answers with the same entries |
| | `undoAddAction(ids)` | up to 100 uuids | deletes your own entries created within the undo window |
| | `addQuickEntryAction` | `quickEntryFormSchema` (kcal, optional name and macros) | "just N kcal" → the day |
| | `updateQuickEntryAction(entryId)` | `quickEntryFormSchema` | → the entry's day |
| | `setFavoriteAction(foodId, starred)` | `starred: boolean` | sets or clears the star (a state, not a toggle); `"limit"` at 100 favorites |
| `app/(app)/recipes/actions.ts` | `createRecipeAction` | `recipeFormSchema` (name, cooked weight?, servings?) | → `/recipes/[id]`; counts toward the 1000 own cap |
| | `updateRecipeAction(recipeId)` | `recipeFormSchema` | → the dish; a weight below the ingredients' total is a field error |
| | `deleteRecipeAction(recipeId)` | — | → `/recipes`; a dish with no diary entries is removed for good, otherwise softly |
| | `addItemAction(recipeId, foodId)` | `addAmountSchema` | → the ingredient search with a toast; up to 50 ingredients; a dish, deleted or foreign food → 404 |
| | `updateItemAction(recipeId, itemId)` | `updateAmountSchema` | → the dish |
| | `deleteItemAction(recipeId, itemId)` | — | → the dish |

The amount form is shared by the diary and dish ingredients (`lib/amount.ts`):
- grams: 0.1–5000, a decimal comma is accepted;
- portion: `portionId` + a count of 0.25–50.

Both values are rounded to the column precision (hundredths), so that `grams = count × portion grams` holds after saving.

## Service routes
Not an API, but they answer with something other than a page:
- `/manifest.webmanifest` (`app/manifest.ts`), `/icon`, `/apple-icon`, `/pwa-icons/[file]`: the PWA manifest and icons (`next/og`);
- `/sw.js`: the service worker from `lib/pwa/service-worker.ts` (`Cache-Control: no-cache`);
- `/offline`: the offline page the worker keeps in its cache;
- `/favicon.ico`: a temporary redirect to `/icon`.
