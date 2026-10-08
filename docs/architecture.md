---
type: note
status: todo
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
| UI | Tailwind v4 (+ shadcn/ui по желанию) | быстро, мобильная вёрстка |
| БД | **Postgres** | надёжно, `pg_trgm` для поиска с опечатками |
| ORM / миграции | Drizzle ORM + drizzle-kit | типы из схемы, SQL-подобный синтаксис |
| Валидация | zod | одна схема для форм, API и ответов AI |
| Авторизация | better-auth или Auth.js (решить на этапе 1) | email + пароль, сессии в БД |
| PWA | manifest + service worker (Serwist) | установка на телефон, офлайн-оболочка |
| Тесты | Vitest (чистые функции), Playwright (позже, ключевые сценарии) | |
| Деплой | Docker Compose: `app` + `postgres`, nginx + TLS на VPS | свой сервер, привычный стек |
| Бэкапы | `pg_dump` по cron → отдельное хранилище | |

## Принципы
> [!tip] Главное правило
> **Калории и БЖУ считает только код в `lib/nutrition.ts`** — чистые функции с тестами. AI возвращает лишь структуру «что и сколько граммов».

- Все константы (коэффициенты активности, % жиров, лимиты AI, модели) — в одном `lib/config.ts`.
- **Снимок нутриентов в записи дневника:** при добавлении копируем ккал/БЖУ в запись. Исправил продукт — история прошлых дней не поменялась.
- Источник каждой записи хранится: `manual | barcode | ai_text | ai_photo | quick`.

## Модель данных (черновик)
| Таблица | Поля (основные) |
| --- | --- |
| `users` | id (uuid), email (уникальный, в нижнем регистре), password_hash (scrypt), created_at |
| `profiles` | user_id (pk → users, cascade), sex, birth_date, height_cm numeric(5,1), weight_kg numeric(5,1), activity_level, goal, updated_at |
| `targets` | id, user_id (→ users, cascade, индекс), name («По умолчанию»), mode (`auto/manual`), kcal, protein_g, fat_g, carbs_g — numeric(8,2), is_default (частичный уникальный индекс: одна норма по умолчанию на пользователя), created_at, updated_at |
| `foods` | id, owner_id (null = общий), name, brand, barcode, source (`user/seed/off/usda/ai_estimate`), kcal_100, protein_100, fat_100, carbs_100, fiber_100?, verified |
| `food_portions` | id, food_id, label («1 шт»), grams |
| `recipes` | id, owner_id, name, cooked_weight_g, servings |
| `recipe_items` | recipe_id, food_id, grams |
| `diary_entries` | id, user_id, date, slot (`breakfast/lunch/dinner/snack`), food_id?, recipe_id?, grams, kcal, protein_g, fat_g, carbs_g (снимок), source, ai_confidence?, created_at |
| `day_settings` | user_id, date, target_id |
| `water_entries` | id, user_id, ts, ml |
| `weight_entries` | id, user_id, date, kg |
| `favorites` | user_id, food_id / recipe_id |
| `ai_requests` | id, user_id, kind (`text/photo/chat`), provider, model, tokens_in, tokens_out, cost_usd, status, created_at |

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
| Сид-набор | ~200 базовых продуктов на русском | собрать один раз, хранить в репо (`db/seed/`) |
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

## Структура репозитория (план)
```text
bitewise/
├── app/                 # роуты Next.js (страницы + api)
├── components/
├── lib/
│   ├── config.ts        # все константы
│   ├── nutrition.ts     # чистые функции расчёта (+ тесты)
│   ├── ai/              # provider.ts, openai.ts, anthropic.ts, schemas.ts
│   └── foods/           # поиск, OFF / USDA клиенты
├── db/
│   ├── schema.ts        # Drizzle-схема
│   ├── migrations/
│   └── seed/
├── docker/              # Dockerfile, compose, nginx.conf
├── docs/                # спеки и планы
└── CLAUDE.md
```
