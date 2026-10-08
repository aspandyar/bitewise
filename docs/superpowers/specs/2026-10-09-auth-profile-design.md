# Этап 1 — `ft/auth-profile`: вход, профиль, норма

Дата: 2026-10-09 · Статус: реализовано · Ветка: `ft/auth-profile` (от `ft/karkas`)

## Цель
Пользователь из списка разрешённых регистрируется по email и паролю, заполняет профиль и сразу видит дневную норму ккал/БЖУ, посчитанную кодом. Норму можно переопределить вручную и вернуть к расчётной.

**Готово, когда:** регистрация (email из allowlist) → онбординг → на главной видна норма; её можно задать вручную, и изменение профиля её не трогает; «Вернуть расчётную» возвращает режим «авто». `pnpm lint` и `pnpm test` зелёные.

## Принятые решения
| Вопрос | Решение | Почему |
| --- | --- | --- |
| Библиотека | Auth.js **v4** (`next-auth@4`) | стабильная версия; выбор пользователя |
| Способ входа | email + пароль (Credentials) | без SMTP и внешних сервисов |
| Сессии | JWT в httpOnly-cookie, срок из `config.ts` | Credentials в Auth.js работает только с JWT |
| Регистрация | только email из env `SIGNUP_ALLOWLIST` | приложение в интернете, пользуются свои |
| Хеш пароля | `node:crypto` scrypt | без зависимостей и нативных модулей |
| Rate limit | в памяти процесса | один инстанс на VPS, Redis не нужен |
| Норма | хранится числами в `targets`, `mode = auto \| manual` | дневник читает готовые числа; ручная норма не перетирается |
| Защита роутов | `requireUserId()` первой строкой в каждой странице группы `app/(app)/` (под Suspense-границей `loading.tsx`) и в каждом action | без `middleware`/`proxy`: `withAuth` v4 не рассчитан на `proxy.ts` Next 16; не в layout: с `cacheComponents` чтение сессии в layout блокирует весь сегмент и ломает сборку |

## Вне этапа
- Несколько норм с выбором на день (схема готова, UI — позже).
- Сброс пароля, смена email, удаление аккаунта.
- OAuth и Drizzle-адаптер Auth.js.
- История веса (этап 8).

## Данные (`db/schema.ts`, одна миграция через `/db-change`)
| Таблица | Поля | Ограничения |
| --- | --- | --- |
| `users` | `id uuid pk default gen_random_uuid()`, `email text not null`, `password_hash text not null`, `created_at timestamptz not null default now()` | unique index `email`; email приводится к нижнему регистру в коде до записи |
| `profiles` | `user_id uuid pk → users.id on delete cascade`, `sex` enum (`male`, `female`), `birth_date date`, `height_cm numeric(5,1)`, `weight_kg numeric(5,1)`, `activity_level` enum (`sedentary`, `light`, `moderate`, `active`, `veryActive`), `goal` enum (`lose`, `maintain`, `gain`), `updated_at timestamptz` | все поля `not null`; возраст не хранится |
| `targets` | `id uuid pk`, `user_id uuid → users.id on delete cascade`, `name text not null`, `mode` enum (`auto`, `manual`), `kcal`, `protein_g`, `fat_g`, `carbs_g` — `numeric(8,2) not null`, `is_default boolean not null default false`, `created_at`, `updated_at` | index `user_id`; partial unique index `(user_id) where is_default` |

Значения enum берутся из констант `config.ts` (`SEXES`, ключи `ACTIVITY_FACTORS`, `GOAL_ADJUSTMENTS`, новый `TARGET_MODES`), чтобы схема и расчёт не разошлись.

## Расчёт нормы (`lib/nutrition.ts`, чистые функции, тесты первыми)
| Функция | Формула |
| --- | --- |
| `calcAgeYears(birthDate, today)` | полных лет; день рождения в этом году ещё не наступил → минус год; 29 февраля в невисокосный год считается наступившим 1 марта |
| `calcBmrKcal` | уже есть (этап 0) |
| `calcTdeeKcal(bmrKcal, activity)` | `bmr × ACTIVITY_FACTORS[activity]` |
| `calcTargetKcal(tdeeKcal, goal)` | `tdee × (1 + GOAL_ADJUSTMENTS[goal])` |
| `calcMacroTargets(kcal, weightKg)` | белок = `weightKg × proteinGPerKg`; жиры = `kcal × fatShareOfKcal / 9`; углеводы = `max(0, kcal − белок×4 − жиры×9) / 4` |
| `calcAutoTargets(profile, today)` | всё вместе → `{ kcal, proteinG, fatG, carbsG }` |

Константы в `config.ts`: `MACRO_TARGETS = { proteinGPerKg: 1.8, fatShareOfKcal: 0.27 }`, `KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 }`. Хранение и расчёт — без округления; округление только в `lib/format.ts` (`formatKcal`, `formatGrams`).

**Контрольный пример** (мужчина, 80 кг, 180 см, 30 лет, `moderate`, `maintain`): BMR 1780 → TDEE 2759 ккал; белок 144 г; жиры 82.77 г; углеводы (2759 − 576 − 744.93) / 4 = 359.5175 г.

## Auth
- `lib/auth/options.ts` — `authOptions`: Credentials `{ email, password }`; `session.strategy = "jwt"`, `maxAge` из config; колбэки `jwt`/`session` кладут только `user.id`; `pages.signIn = "/login"`.
- `app/api/auth/[...nextauth]/route.ts` — `NextAuth(authOptions)` как GET/POST.
- `lib/auth/password.ts` — `hashPassword` / `verifyPassword`: scrypt, соль 16 байт на пользователя, `timingSafeEqual`, формат `scrypt$N$r$p$salt$hash` (параметры из config можно усилить без поломки старых хешей). Битый формат → `false`, не исключение.
- `lib/auth/session.ts` — `getSessionUserId(): Promise<string | null>`, `requireUserId(): Promise<string>` (без сессии — redirect на `/login`).
- `lib/auth/rate-limit.ts` — фиксированное окно в `Map`, время передаётся аргументом. Лимиты в config: вход — 10 попыток / 15 мин на `ip` и на `email`; регистрация — 5 / час на `ip`.
- `lib/auth/allowlist.ts` — разбор `SIGNUP_ALLOWLIST` (через запятую, trim, нижний регистр).

**Вход:** клиентская форма → `signIn("credentials", { redirect: false })`. `authorize`: zod → rate limit → поиск пользователя → проверка пароля. Нет пользователя — всё равно сверка с фиктивным хешем (равное время ответа). Любая неудача — одна ошибка «Неверный email или пароль».

**Регистрация:** server action (единственный публичный, помечен комментарием): zod (email; пароль 8–128 символов, из config) → rate limit → allowlist → создание пользователя. Не в списке или email занят — одно общее сообщение «Регистрация для этого email недоступна». Успех → клиент вызывает `signIn` → `/onboarding`.

**Env** (`lib/env.ts`, zod): `NEXTAUTH_SECRET` (≥ 32 символов), `NEXTAUTH_URL`, `SIGNUP_ALLOWLIST`. Пользователь добавляет их в `.env.example` вручную (файл закрыт правилом для агента).

## Экраны (`app/`, mobile-first 375 px, тексты из `lib/i18n/ru.ts`)
| Роут | Содержимое |
| --- | --- |
| `(auth)/login` | email, пароль, «Войти», ссылка на регистрацию |
| `(auth)/register` | email, пароль, «Создать аккаунт», ссылка на вход |
| `(app)/onboarding` | одна форма: пол (2 сегмента), дата рождения, рост и вес (`inputmode="decimal"`), активность (5 вариантов с пояснением), цель (3 сегмента) |
| `(app)/` | без профиля → redirect `/onboarding`; иначе карточка «Норма на день»: ккал крупно, Б/Ж/У, метка «авто»/«вручную», ссылки «Изменить профиль», «Изменить норму», «Выйти» |
| `(app)/profile` | та же форма, заполненная; в режиме «авто» пересчитывает норму |
| `(app)/targets` | ккал/Б/Ж/У с подсказкой расчётных значений; «Сохранить» → `manual`; «Вернуть расчётную» → `auto` + пересчёт |

Каждая страница `app/(app)/` вызывает `requireUserId()`; `loading.tsx` (он же Suspense-граница для чтения сессии) и `error.tsx` на группу. Тап-зоны ≥ 44 px, ошибки у поля.

## Серверная логика
- Схемы: `lib/profile/schema.ts`, `lib/targets/schema.ts` — общие для формы и action. Диапазоны в config: рост 100–250 см, вес 30–300 кг, возраст 14–100 лет, ккал 800–6000, граммы БЖУ 0–1000.
- Репозитории: `lib/profile/repo.ts`, `lib/targets/repo.ts` — каждый запрос фильтрует по `user_id` из сессии; `user_id` из формы не принимается.
- Сохранение профиля и нормы — в одной транзакции: upsert профиля → если нормы по умолчанию нет или `mode = auto`, записать `calcAutoTargets`.
- Server actions: первая строка — `requireUserId()`, затем zod.

## Тесты
- **Unit** (`lib/nutrition.test.ts` и рядом): возраст (день рождения не наступил, 29 февраля), TDEE, поправка каждой цели, БЖУ из контрольного примера, обрезка углеводов до 0, `calcAutoTargets`, `formatKcal`/`formatGrams`.
- **Пароль:** верный/неверный, битый формат, разная соль у одинаковых паролей.
- **Rate limit:** в пределах лимита, превышение, сброс окна.
- **Валидация:** zod-схемы на границах, allowlist (регистр, пробелы, пустая строка).
- **Интеграционные** (Postgres `bitewise_test`, очистка и миграции перед каждым файлом): upsert профиля; auto-пересчёт; manual не перетирается; reset → auto; изоляция пользователей (A не видит данные B). В CI добавляется сервис Postgres.
- **После реализации:** субагенты `reviewer`, `security-reviewer`, `ui-checker` (сценарий «Готово, когда» на 375 px).

## Новые зависимости
| Пакет | Зачем |
| --- | --- |
| `next-auth@4` | выбранная библиотека авторизации |

Остальное — встроенное (`node:crypto`) или уже есть (zod, drizzle).
