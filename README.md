# Bitewise

PWA для учёта еды и калорий: дневник приёмов пищи, своя база продуктов и блюд, нормы ккал/БЖУ. Цель — записать приём пищи быстрее чем за 15 секунд и честно видеть, сколько осталось до нормы.

Принцип: **числа даёт база продуктов и формула, а не нейросеть.** Все ккал и БЖУ считает код в `lib/nutrition.ts` (чистые функции с тестами). AI на следующих этапах будет только ускорять ввод.

## Что уже работает (MVP, этапы 0–4)

| Этап                | Что умеет                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 `ft/karkas`       | Next.js + TypeScript strict + Tailwind, Postgres в Docker, Drizzle, Vitest, CI                                                                            |
| 1 `ft/auth-profile` | регистрация и вход (email + пароль), профиль, норма ккал/БЖУ (Mifflin-St Jeor) авто или вручную, роли user / manager / admin                              |
| 2 `ft/foods`        | база продуктов на 100 г, свои продукты и порции («1 шт = 60 г»), поиск по 1–2 буквам и с опечатками, сид 222 продуктов (USDA + этикетки)                  |
| 3 `ft/diary`        | день на главной, завтрак / обед / ужин / перекус, записи по граммам или порциям, итоги и прогресс к норме, навигация по дням в часовом поясе пользователя |
| 4 `ft/recipes`      | свои блюда из ингредиентов, вес готового блюда и порции → ккал на 100 г и на порцию, в дневник — как обычный продукт                                      |

Дальше по плану: быстрый ввод (5), PWA и деплой (6), штрихкоды (7), вес и вода (8), AI-ввод текстом и фото (9–12). Подробно — [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Стек

Next.js 16 (App Router, `cacheComponents`) · React 19 · TypeScript strict · Tailwind v4 · Postgres 17 + `pg_trgm` · Drizzle ORM · zod 4 · Auth.js v4 · Vitest · pnpm · Node ≥ 24.

## Быстрый старт

Нужны Node 24+, pnpm и Docker (или Podman) для Postgres.

```bash
pnpm install
cp .env.example .env          # NEXTAUTH_SECRET: openssl rand -base64 32; ADMIN_PASSWORD: openssl rand -base64 24
docker compose up -d db       # Postgres на 127.0.0.1:5433 + тестовая база bitewise_test
pnpm db:migrate               # схема
pnpm db:seed                  # 222 базовых продукта
pnpm admin:bootstrap          # администратор из ADMIN_EMAIL / ADMIN_PASSWORD (по желанию)
pnpm dev                      # http://localhost:3000
```

Подробности, переменные окружения и типичные проблемы — [docs/development.md](docs/development.md).

## Команды

| Команда                                  | Что делает                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | dev-сервер / сборка / запуск сборки                     |
| `pnpm lint`                              | ESLint + генерация типов роутов + `tsc --noEmit`        |
| `pnpm test`                              | все тесты (unit + db); `pnpm test:unit` — только без БД |
| `pnpm db:generate` / `pnpm db:migrate`   | миграция из `db/schema.ts` / применить миграции         |
| `pnpm db:seed`                           | загрузить или обновить базовые продукты (идемпотентно)  |
| `pnpm seed:build <каталог CSV USDA>`     | пересобрать `db/seed/foods.json` из исходников          |
| `pnpm admin:bootstrap`                   | создать администратора из env                           |

## Структура

```text
app/            страницы (App Router), server actions, /api/foods/search, /api/auth
components/     UI: ui/ (формы, кнопки), diary/, foods/, recipes/, auth/, …
lib/            логика без UI
  nutrition.ts  все расчёты ккал/БЖУ (чистые функции + тесты)
  config.ts     все константы и лимиты
  i18n/ru.ts    все тексты интерфейса
  <область>/    repo.ts (запросы к БД) · schema.ts (zod) · types.ts — для auth, foods, diary, recipes, profile, targets, users
db/             schema.ts (Drizzle), migrations/, seed/
tests/          хелперы и global-setup для db-тестов
scripts/        сборка сида, bootstrap администратора
docs/           план, функционал, архитектура, решения, спеки и планы этапов
.claude/        правила, навыки и субагенты для Claude Code
```

## Документация

| Документ                                     | О чём                                            |
| -------------------------------------------- | ------------------------------------------------ |
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | этапы, текущий статус                            |
| [docs/features.md](docs/features.md)         | функционал по уровням                            |
| [docs/architecture.md](docs/architecture.md) | стек, слои, модель данных, расчёты, безопасность |
| [docs/api.md](docs/api.md)                   | HTTP-эндпоинты и server actions                  |
| [docs/development.md](docs/development.md)   | локальная разработка, тесты, миграции, CI        |
| [docs/workflow.md](docs/workflow.md)         | как ведём работу: этапы, Claude Code, ревью      |
| [docs/notes.md](docs/notes.md)               | принятые решения, открытые вопросы, журнал       |
| [docs/superpowers/](docs/superpowers/)       | спеки и планы реализации этапов 3–4              |

## Правила проекта (коротко)

- Калории и БЖУ — только `lib/nutrition.ts`; продукты хранятся на 100 г; запись дневника — снимок на момент добавления.
- Все константы — в `lib/config.ts`, все тексты — в `lib/i18n/ru.ts`.
- Схема БД меняется только миграциями drizzle-kit.
- Комментарии в коде и коммиты — по-английски (Conventional Commits), документация — по-русски.
- Одна ветка = один этап (`ft/<этап>`), мерж в `master` после зелёных lint + test.
- Mobile-first: базовая ширина 375 px.

Полный свод — [CLAUDE.md](CLAUDE.md) и [.claude/rules/](.claude/rules/).
