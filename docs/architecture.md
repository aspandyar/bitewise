---
type: note
status: learning
review: false
tags:
  - project/bitewise
  - project/bitewise/architecture
---
# Bitewise — архитектура

> Наверх: [[Bitewise]] · связано: [[Projects/Bitewise/PROJECT_PLAN|PROJECT_PLAN]] · [[Projects/Bitewise/features|features]] · [[Projects/Bitewise/notes|notes]]

## Стек
| Слой | Выбор | Почему |
| --- | --- | --- |
| Фронт + бэк | **Next.js** (App Router), React, **TypeScript strict** | один язык, API-роуты = бэкенд, ключи AI не уходят в браузер |
| UI | Tailwind v4, свои компоненты (`components/ui`) | быстро, мобильная вёрстка, без лишних зависимостей |
| БД | **Postgres** | надёжно, `pg_trgm` для поиска с опечатками |
| ORM / миграции | Drizzle ORM + drizzle-kit | типы из схемы, SQL-подобный синтаксис |
| Валидация | zod | одна схема для форм, API и ответов AI |
| Авторизация | **Auth.js v4**, Credentials + JWT (30 дней), пароли — scrypt из `node:crypto` | email + пароль; Credentials в Auth.js работает только с JWT |
| PWA | manifest + service worker (этап 6) | установка на телефон, офлайн-оболочка |
| Тесты | Vitest: проект `unit` и проект `db` на отдельной базе `bitewise_test`; UI проверяет субагент ui-checker в браузере | расчёты и запросы — автоматом, вёрстка — глазами |
| Деплой | Docker Compose: `app` + `postgres`, nginx + TLS на VPS (этап 6; сейчас в compose только `db`) | свой сервер, привычный стек |
| Бэкапы | `pg_dump` по cron → отдельное хранилище | |

## Принципы
> [!tip] Главное правило
> **Калории и БЖУ считает только код в `lib/nutrition.ts`** — чистые функции с тестами. AI возвращает лишь структуру «что и сколько граммов».

- Все константы (коэффициенты активности, % жиров, лимиты AI, модели) — в одном `lib/config.ts`.
- **Снимок нутриентов в записи дневника:** при добавлении копируем название и значения продукта на 100 г, итоги записи считает код. Исправил продукт — история прошлых дней не поменялась.
- Источник каждой записи (`manual | barcode | ai_text | ai_photo | quick`) появится колонкой `source` с default на этапах 5–10.
- Блюдо — тоже строка `foods`: поиск, порции и дневник работают с ним как с продуктом, цифры на 100 г пересчитываются из состава.

## Модель данных
Сделано (этапы 1–4) — таблицы до `diary_entries` включительно; ниже черты — план.

| Таблица | Поля (основные) |
| --- | --- |
| `users` | id (uuid), email (уникальный, в нижнем регистре), password_hash (scrypt), role (`user/manager/admin`, по умолчанию `user`; admin — только bootstrap-скриптом), created_at |
| `profiles` | user_id (pk → users, cascade), sex, birth_date, height_cm numeric(5,1), weight_kg numeric(5,1), activity_level, goal, updated_at |
| `targets` | id, user_id (→ users, cascade, индекс), name («По умолчанию»), mode (`auto/manual`), kcal, protein_g, fat_g, carbs_g — numeric(8,2), is_default (частичный уникальный индекс: одна норма по умолчанию на пользователя), created_at, updated_at |
| `foods` | id, owner_id (→ users, cascade, индекс; null = общий из сида), name, search_name (generated: `replace(lower(name), 'ё', 'е')`, GIN `gin_trgm_ops`), kcal_100, protein_100, fat_100, carbs_100 (без клетчатки), fiber_100? — numeric(8,2), source (`user/usda/label`; позже `off/ai_estimate`), seed_key (уникальный: `usda:<fdcId>` / `label:<slug>`), source_url?, copied_from? (`food_source` — откуда скопирован свой продукт, только у `source = user`), deleted_at (мягкое удаление), created_at, updated_at. CHECK: `source = user` ⇔ есть владелец ⇔ нет seed_key; нутриенты ≥ 0; source_url — только `https://`; copied_from — только у своих (страница выводит ссылку ещё и через `safeSourceUrl`). Штрихкод — этап 7 |
| `food_portions` | id, food_id (→ foods, cascade, индекс), user_id (→ users, cascade, индекс; null = общая из сида), label («1 шт»), grams numeric(8,2) > 0, created_at |
| `recipes` | id, user_id (→ users, cascade, индекс), food_id (→ foods, cascade, unique — блюдо само строка `foods`: название, цифры на 100 г, мягкое удаление), cooked_weight_g numeric(8,2)? > 0 (null — по сырому весу), servings integer? > 0 (1–100 в форме), created_at, updated_at. Цифры на 100 г считает `calcRecipe` и пишет `lib/recipes/recompute.ts` в строку `foods` — при каждом изменении блюда, правке своего продукта-ингредиента и сиде; порция «1 порция» — единственная `food_portion` строки-блюда (0,1–5000 г, иначе нет). Блюдо в блюде нельзя |
| `recipe_items` | id, recipe_id (→ recipes, cascade, индекс), user_id (→ users, cascade, индекс), food_id (→ foods, без каскада, индекс — поиск блюд для пересчёта), grams numeric(8,2) > 0, снимок порции portion_label, portion_grams, portion_count (все null или все заданы), created_at. Удаление блюда удаляет состав |
| `diary_entries` | id, user_id (→ users, cascade), date (локальная дата пользователя), meal (`breakfast/lunch/dinner/snack`), food_id (→ foods, без каскада: продукты удаляются мягко), снимок: food_name, kcal_100, protein_100, fat_100, carbs_100 — numeric(8,2); grams > 0; снимок порции portion_label, portion_grams, portion_count (все null или все заданы); created_at, updated_at. Индексы `(user_id, date)` и `food_id`. Итоги считает `lib/nutrition.ts`; блюдо попадает сюда как обычный продукт (`food_id` строки-блюда); `source` — на своём этапе |
| — план — | |
| `day_settings` | user_id, date, target_id |
| `water_entries` | id, user_id, ts, ml |
| `weight_entries` | id, user_id, date, kg |
| `favorites` | user_id, food_id (блюда — тоже строки `foods`) |
| `ai_requests` | id, user_id, kind (`text/photo/chat`), provider, model, tokens_in, tokens_out, cost_usd, status, created_at |

## Слои и поток запроса
```text
страница (Server Component, под <Suspense>)        app/**/page.tsx
  │  requireUserId() → чтение через repo → расчёты lib/nutrition.ts на сервере
  ▼
клиентская форма ("use client")                    components/**
  │  usePreservingFormAction → server action
  ▼
server action                                      app/**/actions.ts
  │  сессия → parseId → zod-схема → repo → redirect / FormState с ошибками у поля
  ▼
repo (каждый запрос фильтрует по user_id)          lib/<область>/repo.ts
  │  Drizzle; транзакции и блокировки для лимитов и пересчёта
  ▼
Postgres 17 (+ pg_trgm)                            db/schema.ts → db/migrations
```
- Чистая логика живёт отдельно от ввода-вывода: `lib/nutrition.ts`, `lib/date.ts`, `lib/format.ts`, zod-схемы, `handleFoodSearch`. Её покрывают unit-тесты; repo покрывают db-тесты.
- `cacheComponents` держит скрытые экраны живыми. Поэтому формы получают `key` из данных или обёртку `ResetOnHide`, а кнопка удаления сбрасывает подтверждение при уходе с экрана.
- «Сегодня» берётся из часового пояса браузера: cookie `tz` ставит `TimeZoneCookie`, без неё — `Asia/Almaty`.

## Безопасность (коротко)
- **Сессии и пароли.** Сессия — JWT Auth.js. Пароли — scrypt (N = 2^15). При неизвестном email считается фиктивный хеш, чтобы время ответа было тем же.
- **Rate limit в памяти** (fail-closed, до 100 тыс. ключей): вход — 10 за 15 минут, регистрация — 5 в час с IP, поиск — 120 в минуту.
- **Роли.** Новые аккаунты всегда `user`. `admin` появляется только через `pnpm admin:bootstrap`; привилегированные действия читают роль из БД.
- **Доступ.** Каждый repo-запрос ограничен `user_id` из сессии. Чужое → 404.
- **Лимиты объёма:** 1000 своих продуктов и блюд, 20 порций на продукт, 50 ингредиентов в блюде, 100 записей дневника в день и 100 000 на аккаунт.
- **Секреты** только в env на сервере, проверяются zod при старте (`lib/env.ts`).

## Расчёт нормы
```text
BMR (муж.) = 10 × вес_кг + 6.25 × рост_см − 5 × возраст + 5
BMR (жен.) = 10 × вес_кг + 6.25 × рост_см − 5 × возраст − 161
TDEE       = BMR × активность (1.2 … 1.9)
Норма ккал = TDEE × (1 + поправка цели)        # −15 % / 0 / +10 %, всё в config
Белок      = вес_кг × г/кг (1.6–2.0)
Жиры       = норма × 25–30 % / 9
Углеводы   = (норма − белок×4 − жиры×9) / 4
```

## Источники данных о продуктах
| Источник | Что даёт | Нюансы |
| --- | --- | --- |
| Свои продукты | всё, что ввёл пользователь | основной источник |
| Сид-набор | 222 базовых продукта на русском: 209 из USDA SR Legacy (перевод названий, порции из `food_portion.csv`) + 13 «с этикетки» (страницы ВкусВилла) | `db/seed/sources/*.json` → `pnpm seed:build` → `db/seed/foods.json` → `pnpm db:seed` |
| **Open Food Facts** | штрихкоды, упакованные продукты, есть СНГ | лицензия ODbL — указать атрибуцию; данные бывают неполными → кэш + пометка |
| **USDA FoodData Central** | «сырые» ингредиенты, точные данные | названия на английском; бесплатный API-ключ |

## AI-конвейер (v0.3)
```text
фото / текст
   │
   ▼
FoodRecognizer (интерфейс)          ← OpenAI | Anthropic, выбор через env AI_PROVIDER / AI_MODEL
   │  ответ строго по zod-схеме:
   │  [{ name, grams, confidence 0..1, note }]
   ▼
сопоставление с базой (pg_trgm)     ← нет совпадения → оценка на 100 г от AI, пометка ai_estimate
   ▼
карточка подтверждения в UI         ← правка граммов / замена продукта / удаление строки
   ▼
lib/nutrition.ts → diary_entries    ← числа считает код, не модель
```
- Фото сжимается на клиенте до ~1024 px; по умолчанию не хранится.
- Лимиты: N запросов в день на пользователя, журнал стоимости в `ai_requests`.
- Ключи только в env на сервере, никогда в клиенте.
- Мини-чат: история правок + текущий список позиций → модель возвращает **новый список**, а не свободный текст.

## Структура репозитория
```text
bitewise/
├── app/
│   ├── (auth)/          # login, register (+ registerAction)
│   ├── (app)/           # главная-дневник, onboarding, profile, targets, foods/**, diary/**, recipes/** + actions.ts
│   └── api/             # foods/search, auth/[...nextauth]
├── components/          # ui/ (формы, удаление в два тапа, ResetOnHide), auth/, diary/, foods/, recipes/, profile/, targets/
├── lib/
│   ├── config.ts        # все константы и лимиты
│   ├── nutrition.ts     # все расчёты (+ тесты)
│   ├── amount.ts        # количество: граммы или порция × N (дневник и состав блюда)
│   ├── date.ts, format.ts, forms.ts, ids.ts, env.ts, i18n/ru.ts
│   ├── auth/            # Auth.js, пароли, лимиты, регистрация, роли
│   ├── foods/ diary/ recipes/ profile/ targets/ users/   # repo.ts · schema.ts · types.ts (+ тесты)
│   └── ai/              # этапы 9–12
├── db/                  # schema.ts, migrations/, seed/ (foods.json + sources/), client.ts
├── docker/postgres/     # init-скрипт тестовой базы
├── scripts/             # build-food-seed.ts, bootstrap-admin.ts
├── tests/               # testDb, хелперы, global-setup, fixtures
├── docs/                # план, функционал, архитектура, API, разработка, процесс, решения, superpowers/
└── .claude/             # rules, skills, agents, settings
```
