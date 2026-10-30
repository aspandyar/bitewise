---
type: note
status: learning
review: false
tags:
  - project/bitewise
  - project/bitewise/architecture
---
# Bitewise — архитектура

[English](../en/architecture.md) · **Русский**

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
| PWA | manifest + service worker, `experimental.useOffline` | установка на телефон, страница «Нет сети», повтор действий после обрыва |
| Тесты | Vitest: проект `unit` и проект `db` на отдельной базе `bitewise_test`; UI проверяет субагент ui-checker в браузере | расчёты и запросы — автоматом, вёрстка — глазами |
| Деплой | Docker Compose на VPS: `db`, `app`, `nginx` (TLS), `certbot`; образ из GHCR (в dev compose только `db`) | свой сервер, привычный стек |
| Бэкапы | `pg_dump` по cron на сервере, 14 дней, ежемесячная проверка восстановления | |

## Принципы
> [!tip] Главное правило
> **Калории и БЖУ считает только код в `lib/nutrition.ts`** — чистые функции с тестами. AI возвращает лишь структуру «что и сколько граммов».

- Все константы (коэффициенты активности, % жиров, лимиты AI, модели) — в одном `lib/config.ts`.
- `db/client.ts` и `lib/env.ts` помечены `server-only`: импорт базы или секретов в клиентский компонент — ошибка сборки (#32). Скрипты (сид, админ, миграции, drizzle-kit) идут через `db/connect.ts` и `lib/env-read.ts`.
- **Снимок нутриентов в записи дневника:** при добавлении копируем название и значения продукта на 100 г, итоги записи считает код. Исправил продукт — история прошлых дней не поменялась.
- Источник каждой записи (`manual | barcode | ai_text | ai_photo | quick`) появится колонкой `source` с default на следующих этапах.
- Блюдо — тоже строка `foods`: поиск, порции и дневник работают с ним как с продуктом, цифры на 100 г пересчитываются из состава.

## Модель данных
Сделано — таблицы до `favorites` включительно; ниже черты — план.

| Таблица | Поля (основные) |
| --- | --- |
| `users` | id (uuid), email (уникальный, в нижнем регистре), password_hash (scrypt), role (`user/manager/admin`, по умолчанию `user`; admin — только bootstrap-скриптом), client_request_id? (ключ формы регистрации, глобально уникален — частичный индекс; повтор регистрации находит созданный аккаунт, #107), token_version integer (0; смена пароля и «Выйти на всех устройствах» увеличивают — сессии со старой версией не действуют, #29), created_at |
| `profiles` | user_id (pk → users, cascade), sex, birth_date, height_cm numeric(5,1), weight_kg numeric(5,1), activity_level, goal, updated_at |
| `targets` | id, user_id (→ users, cascade, индекс), name («По умолчанию»), mode (`auto/manual`), kcal, protein_g, fat_g, carbs_g — numeric(8,2), is_default (частичный уникальный индекс: одна норма по умолчанию на пользователя), created_at, updated_at |
| `foods` | id, owner_id (→ users, cascade, индекс; null = общий: из сида или из Open Food Facts), name, search_name (generated: `replace(lower(name), 'ё', 'е')`, GIN `gin_trgm_ops`), kcal_100, protein_100, fat_100, carbs_100 (без клетчатки), fiber_100? — numeric(8,2), source (`user/usda/label/off`; позже `ai_estimate`), seed_key (уникальный: `usda:<fdcId>` / `label:<slug>` / `off:<штрихкод>`; сид помечает удалёнными только свои источники `usda/label`), barcode? (нормализованный GTIN: UPC-A и GTIN-14 с ведущим нулём — как EAN-13; один на код среди общих и один на код у каждого владельца, удалённые не держат код; CHECK — 8–14 цифр), source_url?, copied_from? (`food_source` — откуда скопирован свой продукт, только у `source = user`), deleted_at (мягкое удаление — только пока на продукт ссылаются записи дневника или ингредиенты; без ссылок строка удаляется совсем, #108), created_at, updated_at. CHECK: `source = user` ⇔ есть владелец ⇔ нет seed_key; нутриенты ≥ 0; source_url — только `https://`; copied_from — только у своих и никогда не `user` (копия своего продукта получает null, #87) (страница выводит ссылку ещё и через `safeSourceUrl`) |
| `food_portions` | id, food_id (→ foods, cascade, индекс), user_id (→ users, cascade, индекс; null = общая из сида), label («1 шт»), grams numeric(8,2) > 0, created_at |
| `recipes` | id, user_id (→ users, cascade, индекс), food_id (→ foods, cascade, unique — блюдо само строка `foods`: название, цифры на 100 г, мягкое удаление), cooked_weight_g numeric(8,2)? > 0 (null — по сырому весу), servings integer? > 0 (1–100 в форме), created_at, updated_at. Цифры на 100 г считает `calcRecipe` и пишет `lib/recipes/recompute.ts` в строку `foods` — при каждом изменении блюда, правке своего продукта-ингредиента и сиде; порция «1 порция» — единственная `food_portion` строки-блюда (0,1–5000 г, иначе нет). Блюдо в блюде нельзя |
| `recipe_items` | id, recipe_id (→ recipes, cascade, индекс), user_id (→ users, cascade, индекс), food_id (→ foods, без каскада, индекс — поиск блюд для пересчёта), grams numeric(8,2) > 0, снимок порции portion_label, portion_grams, portion_count (все null или все заданы), created_at. Удаление блюда удаляет состав |
| `diary_entries` | id, user_id (→ users, cascade), date (локальная дата пользователя), meal (`breakfast/lunch/dinner/snack`), food_id? (→ foods, без каскада: продукты удаляются мягко; null — быстрая запись «просто N ккал», хранится как 100 г × введённые числа на 100 г, без порции — CHECK), снимок: food_name, kcal_100, protein_100, fat_100, carbs_100 — numeric(8,2); grams > 0; снимок порции portion_label, portion_grams, portion_count (все null или все заданы); created_at, updated_at. Индексы `(user_id, date)`, `(user_id, created_at DESC, id DESC)` — для недавних (#93) — и `food_id`. Итоги считает `lib/nutrition.ts`; блюдо попадает сюда как обычный продукт (`food_id` строки-блюда); `source` — на своём этапе |
| `water_entries` | id, user_id (→ users, cascade), date (локальная дата), ml integer > 0, client_request_id?, created_at. Строка на каждое нажатие «+250 / +500» (только `WATER.quickMl`); «Убрать последнее» удаляет строку по id — повтор ничего не удалит. Индекс `(user_id, date)`, лимит `WATER.maxEntriesPerDay` на день |
| `weight_entries` | id, user_id (→ users, cascade), date, weight_kg numeric(5,1) > 0, created_at, updated_at. Одно взвешивание в день: уникальный `(user_id, date)` — он же цель upsert. Самое свежее взвешивание копируется в `profiles.weight_kg` и пересчитывает авто-норму (`saveProfile`; ручная не меняется); при удалении — следующее по свежести |
| `weight_save_requests` | user_id (→ users, cascade), client_request_id, created_at; PK `(user_id, client_request_id)`. Ключи (#95) уже применённых сохранений и правок веса (#132): повтор с таким ключом ничего не пишет, иначе старое значение легло бы поверх нового. В строке взвешивания ключ не хранится — её перезаписывает каждое сохранение. Ключи старше `WEIGHT.requestKeyDays` удаляются в транзакции сохранения |
| общее для `diary_entries`, `foods`, `food_portions`, `recipes`, `recipe_items`, `water_entries` | client_request_id uuid? — ключ запроса, которым клиент создал строку; уникален по владельцу (`(user_id или owner_id, client_request_id)`, частичный индекс `WHERE client_request_id IS NOT NULL`). Повтор того же запроса находит уже созданную строку (#95) |
| `favorites` | user_id (→ users, cascade), food_id (→ foods, cascade, индекс), created_at; первичный ключ `(user_id, food_id)`. Звёздочка у продукта или блюда; на экране «+ Добавить» — над недавними; лимит `QUICK.maxFavorites` |
| — план — | |
| `day_settings` | user_id, date, target_id |
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
- **Тема и акцентный цвет** — cookie `bw-theme` и `bw-accent` на устройстве. Корневой layout их не читает (под `cacheComponents` это сделало бы все экраны «по запросу»): inline-скрипт в `<head>` (`appearanceScript`) до первой отрисовки ставит `data-theme` / `data-accent` на `<html>` и при принудительной теме добавляет первым свой `theme-color` (серверные meta не трогает: React сверяет их по `content` при гидрации и добавил бы второй раз; после гидрации ранний meta убирает `syncThemeColor`), CSS-переменные тем собирает `appearanceCss` из `APPEARANCE` в `lib/config.ts`. Классы — `bg-accent`, `text-on-accent`, `text-accent-text`; вариант `dark:` учитывает и выбор, и систему. Выбор пишет сам браузер (`appearanceCookies`, `Secure` по протоколу страницы), без server action: нет ответа сервера, который перерисовал бы экран старым выбором (#97); «Сохранено» — `showToast` без навигации.
- **PWA.** `/manifest.webmanifest` (`app/manifest.ts`), иконки `/icon`, `/apple-icon`, `/pwa-icons/*` рисует `next/og` при сборке. Service worker `/sw.js` (из `lib/pwa/service-worker.ts`) трогает только навигации (без сети отдаёт `/offline`) и свои иконки (без сети — из кэша). Имя кэша — `bitewise-<хэш>` от офлайн-страницы и настроек иконок: новая страница «Нет сети» доходит до установленных копий без ручной версии; предзагрузка идёт с `cache: "reload"` (#96). В dev оставшийся worker снимается (#98). Обрыв посреди работы — `experimental.useOffline`: переходы и server actions ждут сеть и повторяются, плашка — `OfflineBanner`.
- **Повтор без дублей (#95).** `useOffline` повторяет server action, если оборвался `fetch`, — даже когда первый запрос дошёл и выполнился. Поэтому каждая отправка несёт свой ключ `requestId` (`stampRequestId`: в `usePreservingFormAction` и `KeyedForm`); повтор шлёт тот же FormData и тот же ключ, новое нажатие — новый. Создающие repo-функции под блокировкой записей пользователя (у ингредиентов — строки блюда) сначала ищут строку с этим ключом и возвращают её, иначе вставляют с ключом. Звезда отправляет нужное состояние (`setFavoriteAction`), а не «переключить». Ключ, уже использованный для другой цели (другой день, приём, продукт, блюдо), отклоняется — это подделанный запрос. Удаление, которое ничего не нашло, ведёт туда же, куда успешное (без тоста «удалено»), — и для чужого или несуществующего id, так что существование объектов не раскрывается. Ключ ставит клиентский код, поэтому быстрое «+» и «Скопировать» работают только после загрузки JS: ключ с сервера повторялся бы из кэша `cacheComponents` и съедал бы второе настоящее нажатие. Без `crypto.randomUUID` (http по LAN-адресу) форма уходит без ключа. Хвосты (#107): рядом с ключом форма несёт id вошедшего пользователя (`requestUser`) из cookie `bw-uid` (на https — `__Host-bw-uid`: соседний или родительский домен не может её подложить), которую ставит последняя отрисованная страница (`RequestUserMark`) — общая для вкладок; действия с формой (и «Сбросить норму») берут пользователя через `requireActionUser` и при чужом id не пишут ничего — главная с тостом «ничего не сохранено». Повтор после входа под другим аккаунтом несёт старый id и отклоняется, а свежая отправка из старой вкладки — уже новый. Регистрация тоже ставит ключ: повтор находит созданный аккаунт и входит обычным `signIn`. «Повторить» ставит на записи пачки ключ и производные от него (`sha256(ключ:i)`): повтор отвечает теми же записями, тост «добавлено» с отменой.
- **Логи без данных (#76).** `instrumentation.ts` оборачивает `console.error` / `console.warn`: каждый аргумент проходит `loggableError` — ошибка запроса drizzle (по классу или по форме: в prod-сборке у класса несколько копий), в том числе внутри `cause` и `AggregateError`, необёрнутая ошибка Postgres (её `detail` может повторить значение) и строка с `Failed query:` превращаются в имя ошибки и SQLSTATE, без SQL и параметров; цепочка глубже `LOG_SCRUB.maxDepth` сводится к имени; `digest`, который Next показывает пользователю, сохраняется. `bootstrap-admin` пишет ошибку через тот же `loggableError`.

## Прод
- Отдельный VPS, `docker-compose.prod.yml` (проект `bitewise-prod`): `db` и `app` без опубликованных портов, `nginx` (TLS, HSTS, gzip, `limit_req` на вход и регистрацию, 503 + `Retry-After` во время перезапуска), `certbot` (продление).
- Образ — Next standalone + `ops/*.js` (esbuild: мигратор drizzle-orm с проверками БД, сид, админ). Собирает GitHub Actions по кнопке в GHCR; сервер только скачивает.
- Релиз — `docker/scripts/release.sh <sha> <digest>`: бэкап → роль приложения в БД → миграции → сид → админ → новый контейнер → `/api/health`; ошибка — откат на прошлый образ. Образ скачивается по digest из артефакта сборки, метка коммита сверяется; базовые образы тоже закреплены по digest.
- Права в проде: приложение — своей ролью Postgres без суперпользователя (только строки своих таблиц), миграции — владельцем; каждому контейнеру — только свои переменные; `app` — read-only, без capabilities.
- Заголовки — `lib/security-headers.ts` (CSP с `'unsafe-inline'` для скриптов Next, `Permissions-Policy`); HSTS — в nginx.
- Подробно: [[Projects/Bitewise/deploy|deploy]].

## Безопасность (коротко)
- **Сессии и пароли.** Сессия — JWT Auth.js. Каждое чтение сессии сверяет `token_version` и роль с базой (`checkToken`, один запрос по ключу): после смены пароля или «Выйти на всех устройствах» старые токены не действуют, роль не снимок на момент входа (#29). Пароли — scrypt (N = 2^15). При неизвестном email считается фиктивный хеш, чтобы время ответа было тем же. Смена пароля — с текущим паролем, 5 попыток за 15 минут на аккаунт и версию токена (после «Выйти на всех устройствах» у владельца новый запас); устройство после неё входит заново новым паролем. Ни смена пароля, ни «выйти везде» не подчиняются лимиту записи — вор с украденной сессией не может помешать себя отозвать. Пароль админа в приложении не меняется: он задаётся `ADMIN_PASSWORD`, и bootstrap вернул бы его при деплое.
- **Регистрация** закрыта, пока `REGISTRATION=open` не открыл её (#27): страница и `registerAction` отвечают «Регистрация пока закрыта» до любой работы.
- **Метка устройства (#30).** После входа браузер получает httpOnly-cookie `bw-device` (`__Host-` на https) на год — HMAC от id пользователя, версии токена и времени выпуска на `NEXTAUTH_SECRET`. Смена пароля и «Выйти на всех устройствах» отзывают все метки. Попытки входа с меткой считаются в общем счётчике доверенных устройств аккаунта, отдельном от чужих: неверные пароли со стороны не блокируют владельца, а выпуск новых меток не даёт лишних попыток.
- **Rate limit в памяти** (fail-closed, до 100 тыс. ключей): вход — 10 за 15 минут, регистрация — 5 в час с IP, поиск — 120 в минуту, любая запись (server actions через `requireActionUser` / `requireWriteUser`) — 60 в минуту на пользователя (#31), смена пароля — 5 за 15 минут. Снаружи — `limit_req` nginx. Хеширование паролей — не больше 2 одновременно, очередь до 20 (семафор).
- **Роли.** Новые аккаунты всегда `user`. `admin` появляется только через `pnpm admin:bootstrap`; привилегированные действия читают роль из БД.
- **Доступ.** Каждый repo-запрос ограничен `user_id` из сессии. Чужое → 404.
- **Лимиты объёма:** 1000 своих продуктов и блюд, 20 порций на продукт, 50 ингредиентов в блюде, 100 записей дневника в день и 100 000 на аккаунт.
- **Секреты** только в env на сервере, проверяются zod при старте (`lib/env-read.ts` через `lib/env.ts`).

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
| **Open Food Facts** (этап 7) | штрихкоды, упакованные продукты, есть СНГ | только по коду со сканера; найденное сохраняется общим продуктом `source = 'off'`; неполные данные не сохраняются; атрибуция ODbL — внизу «Продуктов» и на карточке |
| **USDA FoodData Central** | «сырые» ингредиенты, точные данные | названия на английском; бесплатный API-ключ |

### Поиск по штрихкоду
```text
камера (barcode-detector, zxing-wasm с нашего сайта) или цифры руками
   │  checkBarcode: без пробелов, дефисов и невидимых символов; цифры, длина, контрольная цифра
   │  (своё сообщение для опечатки); UPC-A и GTIN-14 → EAN-13, EAN-8 с ведущими нулями → 8 цифр
   ▼
GET /api/foods/barcode?code=[&typed=1]  (сессия, 30/мин на пользователя)
   │  typed=1 — цифры руками: 8 цифр ищутся как EAN-8, а если не нашлись ни у нас, ни в OFF —
   │  ещё и как UPC-E (развёрнутый в UPC-A); камера сама знает формат, её код ищется как есть
   │
   ├─ свой продукт с этим кодом ─────────────┐
   ├─ общий (в т. ч. ранее найденный в OFF) ─┤→ found → экран количества / карточка
   └─ Open Food Facts (7/мин на процесс, 3/мин на пользователя, таймаут 4 с)
        ├─ все цифры есть → общий продукт `off` (+ порция «1 шт») → found
        ├─ неполные / не найден → not_found + подсказки → форма своего продукта со штрихкодом
        └─ не ответил → unavailable → «создать самому» или «сканировать ещё раз»
```
Ккал не досчитываются из БЖУ; кДж → ккал делением на 4,184; значения на порцию — на 100 г только при известном весе порции; 100 мл = 100 г. Разбор ответа — `lib/foods/off.ts`, оркестрация — `lib/foods/barcode-lookup.ts`, сохранение — `lib/foods/barcode-repo.ts` (advisory-блокировка на код против гонки двух сканов).

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
│   ├── (app)/           # главная-дневник, onboarding, profile, targets, foods/**, diary/**, recipes/**, body/** (вес), stats + actions.ts
│   ├── api/             # foods/search, health, auth/[...nextauth]
│   └── manifest.ts, icon.tsx, apple-icon.tsx, pwa-icons/, sw.js/, offline/   # PWA
├── components/          # ui/ (формы, удаление в два тапа, ResetOnHide, плашка «Нет сети»), auth/, diary/, foods/, recipes/, profile/, targets/, water/, body/, stats/, pwa/, brand/
├── lib/
│   ├── config.ts        # все константы и лимиты
│   ├── nutrition.ts     # все расчёты (+ тесты), в том числе итоги дней и периода
│   ├── body.ts, chart.ts  # среднее веса за 7 дней; масштабы SVG-графиков
│   ├── amount.ts        # количество: граммы или порция × N (дневник и состав блюда)
│   ├── date.ts, format.ts, forms.ts, ids.ts, i18n/ru.ts
│   ├── env.ts, env-read.ts  # переменные окружения: для приложения (server-only) и для скриптов
│   ├── log.ts, request-id.ts, toast.ts   # очистка логов, ключ запроса, уведомления
│   ├── appearance.ts    # тема и акцент: палитра → CSS, скрипт в <head>, контраст
│   ├── pwa/             # иконки, service worker, офлайн-страница, подсказка установки
│   ├── auth/            # Auth.js, пароли, лимиты, регистрация, роли, версия токена, метка устройства
│   ├── foods/ diary/ recipes/ profile/ targets/ users/ water/ weight/ stats/   # repo.ts · schema.ts · types.ts (+ тесты)
│   └── ai/              # этапы 9–12
├── db/                  # schema.ts, migrations/, seed/ (foods.json + sources/), client.ts (server-only), connect.ts (скрипты), ops/ (мигратор образа)
├── scripts/             # build-food-seed.ts, bootstrap-admin.ts
├── docker/              # postgres init, nginx-шаблон, скрипты релиза и бэкапа, crontab
├── Dockerfile, docker-compose.prod.yml   # прод-образ и стек
├── instrumentation.ts   # при старте: очистка логов, проверка REGISTRATION
├── tests/               # testDb, хелперы, global-setup, fixtures
├── docs/                # ru/ — документация по-русски (+ superpowers/: спеки и планы этапов), en/ — по-английски
└── .claude/             # rules, skills, agents, settings
```
