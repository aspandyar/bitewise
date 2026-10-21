# Этап 1 — Auth и профиль: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** пользователь из allowlist регистрируется по email и паролю, заполняет профиль и видит дневную норму ккал/БЖУ; норму можно задать вручную и вернуть к расчётной.

**Architecture:** Auth.js v4 (Credentials + JWT) поверх своей таблицы `users`; хеш пароля — `node:crypto` scrypt; rate limit в памяти. Расчёт нормы — чистые функции в `lib/nutrition.ts`; профиль и норма по умолчанию сохраняются в одной транзакции, `targets.mode` (`auto`/`manual`) решает, пересчитывать ли норму. Логика (authorize, register, схемы) — чистые модули с внедряемыми зависимостями, Next-слой (actions, pages) — тонкий.

**Tech Stack:** Next.js 16.4 (App Router, `cacheComponents: true`), React 19, TypeScript strict, Tailwind v4, Drizzle ORM 0.45 + postgres.js, zod 4, next-auth 4.24, Vitest 5.

**Spec:** `docs/ru/superpowers/specs/2026-10-09-auth-profile-design.md`

## Global Constraints
- Основная ветка — `master` (никогда `main`); работа в `ft/auth-profile`.
- Все числа и лимиты — в `lib/config.ts`; в коде нет магических чисел.
- Калории и БЖУ считает только `lib/nutrition.ts`; хранение и расчёт без округления, округление только в `lib/format.ts`.
- Тексты интерфейса и ошибок — только из `lib/i18n/ru.ts`.
- Комментарии — по-английски и только «почему». Имена тестов — по-английски, описывают поведение.
- Схема БД — только `db/schema.ts`; миграции — `pnpm db:generate`, показать SQL пользователю, после «ок» — `pnpm db:migrate`. Никогда не править `db/migrations/**` и не использовать `drizzle-kit push`.
- Числа нутриентов в БД — `numeric(8,2)`; каждая пользовательская таблица — `user_id` + индекс; каждый запрос фильтрует по `user_id` из сессии.
- Каждый server action — `requireUserId()` первой строкой (кроме регистрации, она публичная и помечена комментарием); вход — zod.
- Mobile-first 375 px, тап-зоны ≥ 44 px (`min-h-11`), ошибки у поля.
- Агент не может читать/править `.env*` (правило в `.claude/settings.json`); env-файлы правит пользователь.
- Новые зависимости: только `next-auth@4`.

## Review Focus
1. Десятичная запятая: «80,5» в росте/весе/норме принимается как 80.5 (русская клавиатура телефона), пустое поле — ошибка, а не 0.
2. После серверной ошибки валидации форма сохраняет введённые значения (React 19 сбрасывает форму после `action`, поэтому формы отправляются через `onSubmit` + `startTransition`).
3. Email с пробелами и в другом регистре (`  Me@Mail.com `) регистрируется, входит и сверяется с allowlist как `me@mail.com`.
4. Несуществующая дата (`2026-02-30`), дата в будущем, возраст вне 14–100 — ошибка у поля, не 500.
5. Повторная регистрация того же email — общее сообщение «недоступна», не 500 от unique-индекса.

Где закреплено тестами: п. 1 — `lib/forms.test.ts` и `lib/targets/schema.test.ts` (задача 4); п. 3 — `allowlist.test.ts`, `schema.test.ts` (задача 4) и `authorize.test.ts`, `register.test.ts` (задача 5); п. 4 — `date.test.ts` (задача 1) и `profile/schema.test.ts` (задача 4); п. 5 — `users/repo.db.test.ts` (задача 3) и `register.test.ts` (задача 5). П. 2 — поведение браузера: ручной сценарий задачи 9 и `ui-checker`.

## Перед началом (делает пользователь)
Добавить в `.env.example` (и скопировать в `.env`), заодно исправив порт 5432 → 5433:
```text
POSTGRES_PORT=5433
DATABASE_URL=postgres://bitewise:bitewise@localhost:5433/bitewise
DATABASE_URL_TEST=postgres://bitewise:bitewise@localhost:5433/bitewise_test

# Auth.js: generate with `openssl rand -base64 32`
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
# Comma-separated emails allowed to sign up
SIGNUP_ALLOWLIST=
```
`docker compose up -d db` должен быть запущен (интеграционные тесты ходят в `bitewise_test`).

## Файлы
| Файл | Ответственность |
| --- | --- |
| `lib/config.ts` (изм.) | кортежи enum-значений, нормы БЖУ, лимиты форм, auth, scrypt, rate limit |
| `lib/date.ts` | `IsoDate`, `parseIsoDate`, `todayIsoDate` |
| `lib/nutrition.ts` (изм.) | возраст, TDEE, целевые ккал, БЖУ, `calcAutoTargets` |
| `lib/format.ts` | `formatKcal`, `formatGrams` |
| `lib/i18n/ru.ts` (изм.) | тексты auth, профиля, нормы, ошибок |
| `lib/forms.ts` | `FormState`, `firstFieldErrors`, `decimalField` |
| `lib/auth/password.ts` | scrypt-хеш и проверка, фиктивный хеш |
| `lib/auth/rate-limit.ts` | `createRateLimiter` |
| `lib/auth/limiters.ts` | синглтоны лимитеров входа и регистрации |
| `lib/auth/request.ts` | `clientIpFromForwardedFor` |
| `lib/auth/allowlist.ts` | `normalizeEmail`, `parseAllowlist`, `isEmailAllowed` |
| `lib/auth/schema.ts` | `credentialsSchema` |
| `lib/auth/authorize.ts` | `authorizeCredentials` (чистая, deps внедряются) |
| `lib/auth/register.ts` | `registerUser` (чистая, deps внедряются) |
| `lib/auth/options.ts` | `authOptions` Auth.js |
| `lib/auth/session.ts` | `getSessionUserId`, `requireUserId` |
| `types/next-auth.d.ts` | `session.user.id` в типах |
| `lib/env.ts` (изм.) | `readDbEnv`, `readAuthEnv` |
| `db/schema.ts` (изм.) | enum-ы, `users`, `profiles`, `targets` |
| `db/types.ts` | тип `Db` для репозиториев и транзакций |
| `db/client.ts` (изм.) | `readDbEnv` |
| `lib/users/repo.ts` | `findUserByEmail`, `createUser` |
| `lib/profile/schema.ts` | `makeProfileSchema(today)` |
| `lib/profile/repo.ts` | `getProfile`, `saveProfile` (транзакция + синхронизация нормы) |
| `lib/targets/schema.ts` | `targetsSchema` |
| `lib/targets/repo.ts` | `getDefaultTarget`, `upsertDefaultTarget`, `setManualTarget`, `resetTargetToAuto` |
| `tests/db.ts`, `tests/global-setup.ts` | клиент тестовой БД, миграции, очистка |
| `vitest.config.ts` (изм.) | проекты `unit` и `db` |
| `.github/workflows/ci.yml` (изм.) | сервис Postgres для `db`-тестов |
| `app/api/auth/[...nextauth]/route.ts` | обработчик Auth.js |
| `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/register/actions.ts` | вход и регистрация |
| `app/(app)/page.tsx` (перенос из `app/page.tsx`), `onboarding/`, `profile/`, `targets/` | экраны |
| `app/(app)/actions.ts` | `saveProfileAction`, `saveManualTargetAction`, `resetTargetAction` |
| `app/(app)/loading.tsx`, `app/(app)/error.tsx` | состояния загрузки и ошибки |
| `components/ui/form.tsx` | `TextField`, `ChoiceGroup`, `SubmitButton`, `FormError`, `usePreservingFormAction` |
| `components/auth/login-form.tsx`, `register-form.tsx`, `sign-out-button.tsx` | клиентские формы auth |
| `components/profile/profile-form.tsx`, `components/targets/targets-form.tsx` | клиентские формы |

---

### Task 1: Расчёт нормы, даты и форматирование

**Files:**
- Modify: `lib/config.ts`, `lib/nutrition.ts`, `lib/nutrition.test.ts`
- Create: `lib/date.ts`, `lib/date.test.ts`, `lib/format.ts`, `lib/format.test.ts`

**Interfaces:**
- Consumes: `calcBmrKcal`, `BmrInput` (этап 0).
- Produces:
  - `config`: `SEXES`, `Sex`, `ACTIVITY_LEVELS`, `ActivityLevel`, `ACTIVITY_FACTORS`, `GOALS`, `Goal`, `GOAL_ADJUSTMENTS`, `TARGET_MODES`, `TargetMode`, `MACRO_TARGETS`, `KCAL_PER_GRAM`, `PROFILE_LIMITS`, `TARGET_LIMITS`.
  - `lib/date.ts`: `type IsoDate = string`; `parseIsoDate(value: string): { year: number; month: number; day: number } | null`; `todayIsoDate(now: Date): IsoDate`.
  - `lib/nutrition.ts`: `calcAgeYears(birthDate: IsoDate, today: IsoDate): number`; `calcTdeeKcal(bmrKcal: number, activityLevel: ActivityLevel): number`; `calcTargetKcal(tdeeKcal: number, goal: Goal): number`; `type MacroTargets = { kcal: number; proteinG: number; fatG: number; carbsG: number }`; `calcMacroTargets(kcal: number, weightKg: number): MacroTargets`; `type ProfileData = { sex: Sex; birthDate: IsoDate; heightCm: number; weightKg: number; activityLevel: ActivityLevel; goal: Goal }`; `calcAutoTargets(profile: ProfileData, today: IsoDate): MacroTargets`.
  - `lib/format.ts`: `formatKcal(kcal: number): string`; `formatGrams(grams: number): string`.

- [ ] **Step 1: Обновить `lib/config.ts`** — заменить блоки активности и целей на кортежи и добавить новые константы (это не логика, а данные; тесты расчёта ниже их используют):

```ts
// Every tunable number in the app lives here so formulas stay free of magic values.

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

// Mifflin-St Jeor: BMR = weight × 10 + height × 6.25 − age × 5 + sex constant.
export const MIFFLIN_ST_JEOR = {
  kcalPerKg: 10,
  kcalPerCm: 6.25,
  kcalPerYear: 5,
  sexConstantKcal: {
    male: 5,
    female: -161,
  },
} as const satisfies {
  kcalPerKg: number;
  kcalPerCm: number;
  kcalPerYear: number;
  sexConstantKcal: Record<Sex, number>;
};

// Tuples double as Postgres enum values and zod enum options, so the DB and forms cannot drift.
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "veryActive"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

// TDEE = BMR × factor.
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const satisfies Record<ActivityLevel, number>;

export const GOALS = ["lose", "maintain", "gain"] as const;
export type Goal = (typeof GOALS)[number];

// Daily target kcal = TDEE × (1 + adjustment).
export const GOAL_ADJUSTMENTS = {
  lose: -0.15,
  maintain: 0,
  gain: 0.1,
} as const satisfies Record<Goal, number>;

export const TARGET_MODES = ["auto", "manual"] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

// Midpoints of the common ranges (1.6–2.0 g/kg protein, 25–30 % fat).
export const MACRO_TARGETS = {
  proteinGPerKg: 1.8,
  fatShareOfKcal: 0.27,
} as const;

export const KCAL_PER_GRAM = {
  protein: 4,
  fat: 9,
  carbs: 4,
} as const;

// Plausible human ranges: wider would let typos (1800 cm) through, narrower would reject real people.
export const PROFILE_LIMITS = {
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  ageYears: { min: 14, max: 100 },
} as const;

export const TARGET_LIMITS = {
  kcal: { min: 800, max: 6000 },
  macroG: { min: 0, max: 1000 },
} as const;
```

- [ ] **Step 2: Написать падающие тесты дат** — `lib/date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseIsoDate, todayIsoDate } from "./date";

describe("parseIsoDate", () => {
  it("parses a valid calendar date", () => {
    expect(parseIsoDate("2026-10-09")).toEqual({ year: 2026, month: 10, day: 9 });
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "26-10-09", "2026-10-9", ""])(
    "returns null for %j",
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );
});

describe("todayIsoDate", () => {
  it("formats the UTC calendar date", () => {
    expect(todayIsoDate(new Date("2026-10-09T23:30:00Z"))).toBe("2026-10-09");
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что падает**

Run: `pnpm exec vitest run lib/date.test.ts`
Expected: FAIL — `Cannot find module './date'`.

- [ ] **Step 4: Реализовать `lib/date.ts`**

```ts
// Calendar dates travel as "YYYY-MM-DD" strings: Postgres `date` returns them that way and
// they carry no time zone, so a birthday never shifts by a day.
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC silently rolls over (Feb 30 → Mar 2), so a round-trip catches impossible dates.
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrips ? { year, month, day } : null;
}

// UTC is good enough for "today" here: it only feeds age, where a one-day shift is irrelevant.
export function todayIsoDate(now: Date): IsoDate {
  return now.toISOString().slice(0, 10);
}
```

- [ ] **Step 5: Запустить тесты дат** — `pnpm exec vitest run lib/date.test.ts` → PASS.

- [ ] **Step 6: Дописать падающие тесты расчёта** — в конец `lib/nutrition.test.ts` (импорт расширить: `import { calcAgeYears, calcAutoTargets, calcBmrKcal, calcMacroTargets, calcTargetKcal, calcTdeeKcal } from "./nutrition";`):

```ts
describe("calcAgeYears", () => {
  it("counts full years when the birthday already passed this year", () => {
    expect(calcAgeYears("1996-03-15", "2026-10-09")).toBe(30);
  });

  it("subtracts a year when the birthday is still ahead", () => {
    expect(calcAgeYears("1996-10-10", "2026-10-09")).toBe(29);
  });

  it("counts the birthday itself as passed", () => {
    expect(calcAgeYears("1996-10-09", "2026-10-09")).toBe(30);
  });

  it("treats Feb 29 birthdays as not yet passed on Feb 28 of a common year", () => {
    expect(calcAgeYears("2004-02-29", "2027-02-28")).toBe(22);
  });

  it("treats Feb 29 birthdays as passed on Mar 1 of a common year", () => {
    expect(calcAgeYears("2004-02-29", "2027-03-01")).toBe(23);
  });

  it("throws RangeError for an impossible date", () => {
    expect(() => calcAgeYears("2026-02-30", "2026-10-09")).toThrow(RangeError);
  });
});

describe("calcTdeeKcal", () => {
  it("multiplies BMR by the activity factor: 1780 × 1.55 = 2759", () => {
    expect(calcTdeeKcal(1780, "moderate")).toBeCloseTo(2759, 6);
  });

  it("uses 1.2 for sedentary: 1780 × 1.2 = 2136", () => {
    expect(calcTdeeKcal(1780, "sedentary")).toBeCloseTo(2136, 6);
  });
});

describe("calcTargetKcal", () => {
  it.each([
    ["lose", 2345.15], // 2759 × 0.85
    ["maintain", 2759],
    ["gain", 3034.9], // 2759 × 1.1
  ] as const)("applies the %s adjustment", (goal, expected) => {
    expect(calcTargetKcal(2759, goal)).toBeCloseTo(expected, 6);
  });
});

describe("calcMacroTargets", () => {
  it("splits 2759 kcal for 80 kg into 144 g protein, 82.77 g fat, 359.5175 g carbs", () => {
    // protein 80 × 1.8 = 144; fat 2759 × 0.27 / 9 = 82.77; carbs (2759 − 576 − 744.93) / 4
    const macros = calcMacroTargets(2759, 80);
    expect(macros.kcal).toBe(2759);
    expect(macros.proteinG).toBeCloseTo(144, 6);
    expect(macros.fatG).toBeCloseTo(82.77, 6);
    expect(macros.carbsG).toBeCloseTo(359.5175, 6);
  });

  it("clamps carbs to 0 when protein and fat already exceed the kcal target", () => {
    // protein 150 × 1.8 = 270 g = 1080 kcal > 1000 kcal
    const macros = calcMacroTargets(1000, 150);
    expect(macros.proteinG).toBeCloseTo(270, 6);
    expect(macros.fatG).toBeCloseTo(30, 6);
    expect(macros.carbsG).toBe(0);
  });
});

describe("calcAutoTargets", () => {
  const profile = {
    sex: "male",
    birthDate: "1996-03-15",
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
    goal: "maintain",
  } as const;

  it("chains BMR, TDEE, goal and macros for the reference profile", () => {
    const targets = calcAutoTargets(profile, "2026-10-09");
    expect(targets.kcal).toBeCloseTo(2759, 6);
    expect(targets.proteinG).toBeCloseTo(144, 6);
    expect(targets.fatG).toBeCloseTo(82.77, 6);
    expect(targets.carbsG).toBeCloseTo(359.5175, 6);
  });

  it("applies the lose goal before splitting macros", () => {
    // 2759 × 0.85 = 2345.15; fat 2345.15 × 0.27 / 9 = 70.3545; carbs (2345.15 − 576 − 633.1905) / 4
    const targets = calcAutoTargets({ ...profile, goal: "lose" }, "2026-10-09");
    expect(targets.kcal).toBeCloseTo(2345.15, 6);
    expect(targets.fatG).toBeCloseTo(70.3545, 6);
    expect(targets.carbsG).toBeCloseTo(283.989875, 6);
  });
});
```

- [ ] **Step 7: Запустить и убедиться, что падает** — `pnpm exec vitest run lib/nutrition.test.ts` → FAIL (`calcAgeYears is not a function` и т. п.).

- [ ] **Step 8: Реализовать** — дописать в `lib/nutrition.ts` (импорт заменить на `import { ACTIVITY_FACTORS, GOAL_ADJUSTMENTS, KCAL_PER_GRAM, MACRO_TARGETS, MIFFLIN_ST_JEOR, type ActivityLevel, type Goal, type Sex } from "@/lib/config";` и добавить `import { parseIsoDate, type IsoDate } from "@/lib/date";`):

```ts
export function calcAgeYears(birthDate: IsoDate, today: IsoDate): number {
  const birth = parseIsoDate(birthDate);
  const now = parseIsoDate(today);
  if (!birth || !now) {
    throw new RangeError(`invalid date: birthDate=${birthDate}, today=${today}`);
  }
  // Comparing (month, day) pairs makes Feb 29 birthdays count from Mar 1 in common years.
  const hadBirthday = now.month > birth.month || (now.month === birth.month && now.day >= birth.day);
  return now.year - birth.year - (hadBirthday ? 0 : 1);
}

export function calcTdeeKcal(bmrKcal: number, activityLevel: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activityLevel];
}

export function calcTargetKcal(tdeeKcal: number, goal: Goal): number {
  return tdeeKcal * (1 + GOAL_ADJUSTMENTS[goal]);
}

export type MacroTargets = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export function calcMacroTargets(kcal: number, weightKg: number): MacroTargets {
  const proteinG = weightKg * MACRO_TARGETS.proteinGPerKg;
  const fatG = (kcal * MACRO_TARGETS.fatShareOfKcal) / KCAL_PER_GRAM.fat;
  const carbsKcal = kcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  // Negative grams are meaningless; a very low kcal target for a heavy person just leaves no carbs.
  const carbsG = Math.max(0, carbsKcal) / KCAL_PER_GRAM.carbs;
  return { kcal, proteinG, fatG, carbsG };
}

export type ProfileData = {
  sex: Sex;
  birthDate: IsoDate;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
};

export function calcAutoTargets(profile: ProfileData, today: IsoDate): MacroTargets {
  const bmrKcal = calcBmrKcal({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    ageYears: calcAgeYears(profile.birthDate, today),
  });
  const kcal = calcTargetKcal(calcTdeeKcal(bmrKcal, profile.activityLevel), profile.goal);
  return calcMacroTargets(kcal, profile.weightKg);
}
```

- [ ] **Step 9: Запустить** — `pnpm exec vitest run lib/nutrition.test.ts` → PASS.

- [ ] **Step 10: Тест форматирования** — `lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatGrams, formatKcal } from "./format";

describe("formatKcal", () => {
  it("hides floating-point noise", () => {
    expect(formatKcal(2759.0000000000005)).toBe("2759");
  });

  it("rounds half up", () => {
    expect(formatKcal(2345.5)).toBe("2346");
  });
});

describe("formatGrams", () => {
  it("rounds to whole grams", () => {
    expect(formatGrams(82.77)).toBe("83");
  });

  it("shows 0 for 0 g", () => {
    expect(formatGrams(0)).toBe("0");
  });
});
```

Run: `pnpm exec vitest run lib/format.test.ts` → FAIL (module not found).

- [ ] **Step 11: Реализовать `lib/format.ts`**

```ts
// Rounding lives only here: stored and computed values keep full precision.
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

export function formatGrams(grams: number): string {
  return String(Math.round(grams));
}
```

Run: `pnpm test && pnpm lint` → PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/config.ts lib/date.ts lib/date.test.ts lib/nutrition.ts lib/nutrition.test.ts lib/format.ts lib/format.test.ts
git commit -m "feat: calculate daily kcal and macro targets from profile"
```

---

### Task 2: Хеш пароля и rate limit

**Files:**
- Modify: `lib/config.ts`
- Create: `lib/auth/password.ts`, `lib/auth/password.test.ts`, `lib/auth/rate-limit.ts`, `lib/auth/rate-limit.test.ts`, `lib/auth/limiters.ts`, `lib/auth/request.ts`, `lib/auth/request.test.ts`

**Interfaces:**
- Produces:
  - `config`: `AUTH`, `PASSWORD_HASH`, `RATE_LIMITS`.
  - `hashPassword(password: string): Promise<string>`; `verifyPassword(password: string, stored: string): Promise<boolean>`; `getDummyPasswordHash(): Promise<string>`.
  - `type RateLimitRule = { max: number; windowMs: number; maxKeys: number }`; `type RateLimiter = { hit(key: string, nowMs: number): boolean; size(): number }`; `createRateLimiter(rule: RateLimitRule): RateLimiter`.
  - `loginLimiter`, `registerLimiter` (`RateLimiter`).
  - `clientIpFromForwardedFor(value: string | null | undefined): string`.

- [ ] **Step 1: Дописать в `lib/config.ts`**

```ts
const MS_PER_MINUTE = 60_000;
const SECONDS_PER_DAY = 86_400;

export const AUTH = {
  passwordLength: { min: 8, max: 128 },
  sessionMaxAgeSec: 30 * SECONDS_PER_DAY,
} as const;

// OWASP scrypt profile (N=2^15, r=8, p=3): ~32 MB per hash keeps a small VPS responsive.
export const PASSWORD_HASH = {
  N: 2 ** 15,
  r: 8,
  p: 3,
  keyLength: 64,
  saltBytes: 16,
  maxmemBytes: 64 * 1024 * 1024,
} as const;

export const RATE_LIMITS = {
  login: { max: 10, windowMs: 15 * MS_PER_MINUTE, maxKeys: 10_000 },
  register: { max: 5, windowMs: 60 * MS_PER_MINUTE, maxKeys: 10_000 },
} as const;
```

- [ ] **Step 2: Падающие тесты пароля** — `lib/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("never stores the plain password and salts every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toContain("same password");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
  });

  it.each(["", "plain", "scrypt$1$2$3", "bcrypt$32768$8$3$c2FsdA==$aGFzaA==", "scrypt$abc$8$3$c2FsdA==$aGFzaA=="])(
    "returns false for malformed stored hash %j",
    async (stored) => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    },
  );

  it("provides a dummy hash that no password matches", async () => {
    const dummy = await getDummyPasswordHash();
    expect(await verifyPassword("", dummy)).toBe(false);
  });
});
```

Run: `pnpm exec vitest run lib/auth/password.test.ts` → FAIL (module not found).

- [ ] **Step 3: Реализовать `lib/auth/password.ts`**

```ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { PASSWORD_HASH } from "@/lib/config";

type ScryptParams = { N: number; r: number; p: number; keyLength: number };

const PREFIX = "scrypt";
const PARTS = 6;

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keyLength,
      { N: params.N, r: params.r, p: params.p, maxmem: PASSWORD_HASH.maxmemBytes },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

// Parameters are stored with each hash so config can be strengthened without breaking old users.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_HASH.saltBytes);
  const key = await deriveKey(password, salt, PASSWORD_HASH);
  const { N, r, p } = PASSWORD_HASH;
  return [PREFIX, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

function parseStoredHash(stored: string): (ScryptParams & { salt: Buffer; hash: Buffer }) | null {
  const parts = stored.split("$");
  if (parts.length !== PARTS || parts[0] !== PREFIX) return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const hash = Buffer.from(parts[5] ?? "", "base64");
  if (salt.length === 0 || hash.length === 0) return null;
  return { N, r, p, keyLength: hash.length, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  try {
    const key = await deriveKey(password, parsed.salt, parsed);
    return timingSafeEqual(key, parsed.hash);
  } catch {
    // Invalid scrypt parameters in a corrupted row mean "no match", not a 500.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

// Login compares against this when the email is unknown, so response time does not reveal
// which emails are registered.
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(PASSWORD_HASH.saltBytes).toString("hex"));
  return dummyHash;
}
```

Run: `pnpm exec vitest run lib/auth/password.test.ts` → PASS.

- [ ] **Step 4: Падающие тесты rate limit и IP** — `lib/auth/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max hits per key inside the window", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 10)).toBe(true);
    expect(limiter.hit("a", 20)).toBe(false);
  });

  it("counts keys independently", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("b", 0)).toBe(true);
    expect(limiter.hit("a", 1)).toBe(false);
  });

  it("starts a new window once the old one expires", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 999)).toBe(false);
    expect(limiter.hit("a", 1000)).toBe(true);
  });

  it("drops expired keys when the key limit is reached", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 });
    limiter.hit("a", 0);
    limiter.hit("b", 0);
    limiter.hit("c", 5000);
    expect(limiter.size()).toBe(1);
  });
});
```

`lib/auth/request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientIpFromForwardedFor } from "./request";

describe("clientIpFromForwardedFor", () => {
  it("takes the first address of the chain", () => {
    expect(clientIpFromForwardedFor("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
  });

  it.each([null, undefined, "", "  "])("falls back to 'unknown' for %j", (value) => {
    expect(clientIpFromForwardedFor(value)).toBe("unknown");
  });
});
```

Run: `pnpm exec vitest run lib/auth` → FAIL (modules not found).

- [ ] **Step 5: Реализовать** — `lib/auth/rate-limit.ts`:

```ts
export type RateLimitRule = { max: number; windowMs: number; maxKeys: number };
export type RateLimiter = { hit(key: string, nowMs: number): boolean; size(): number };

// In-process fixed window: the app runs as a single container, so shared storage is not needed yet.
export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const windows = new Map<string, { startMs: number; count: number }>();

  function pruneExpired(nowMs: number) {
    for (const [key, window] of windows) {
      if (nowMs - window.startMs >= rule.windowMs) windows.delete(key);
    }
  }

  return {
    hit(key, nowMs) {
      const current = windows.get(key);
      if (!current || nowMs - current.startMs >= rule.windowMs) {
        // Bounded memory: a flood of unique keys cannot grow the map forever.
        if (!current && windows.size >= rule.maxKeys) pruneExpired(nowMs);
        windows.set(key, { startMs: nowMs, count: 1 });
        return true;
      }
      if (current.count >= rule.max) return false;
      current.count += 1;
      return true;
    },
    size: () => windows.size,
  };
}
```

`lib/auth/request.ts`:

```ts
const UNKNOWN_IP = "unknown";

// nginx (stage 6) must overwrite X-Forwarded-For, otherwise clients can spoof it to dodge limits.
export function clientIpFromForwardedFor(value: string | null | undefined): string {
  const first = value?.split(",")[0]?.trim();
  return first ? first : UNKNOWN_IP;
}
```

`lib/auth/limiters.ts`:

```ts
import { RATE_LIMITS } from "@/lib/config";
import { createRateLimiter } from "./rate-limit";

// Module-level singletons: one counter per server process.
export const loginLimiter = createRateLimiter(RATE_LIMITS.login);
export const registerLimiter = createRateLimiter(RATE_LIMITS.register);
```

Run: `pnpm test && pnpm lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/config.ts lib/auth
git commit -m "feat: add scrypt password hashing and in-memory rate limiter"
```

---

### Task 3: Схемы БД, миграция и тестовая база

**Files:**
- Modify: `db/schema.ts`, `db/client.ts`, `lib/env.ts`, `drizzle.config.ts`, `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `docs/ru/architecture.md`
- Create: `db/types.ts`, `tests/db.ts`, `tests/global-setup.ts`, `lib/users/repo.ts`, `lib/users/repo.db.test.ts`
- Generated: `db/migrations/0000_*.sql` (только через `pnpm db:generate`)

**Interfaces:**
- Consumes: `SEXES`, `ACTIVITY_LEVELS`, `GOALS`, `TARGET_MODES` из `lib/config.ts`.
- Produces:
  - `db/schema.ts`: `users`, `profiles`, `targets` (поля в camelCase: `passwordHash`, `birthDate`, `heightCm`, `weightKg`, `activityLevel`, `proteinG`, `fatG`, `carbsG`, `isDefault`, `createdAt`, `updatedAt`).
  - `db/types.ts`: `type Db` — принимает и `db`, и транзакцию.
  - `lib/env.ts`: `readDbEnv(): { DATABASE_URL: string }`; `readAuthEnv(): { NEXTAUTH_SECRET: string; NEXTAUTH_URL: string; SIGNUP_ALLOWLIST: string }`.
  - `tests/db.ts`: `testDb: Db`, `resetDb(): Promise<void>`, `closeTestDb(): Promise<void>`.
  - `lib/users/repo.ts`: `findUserByEmail(db: Db, email: string): Promise<{ id: string; passwordHash: string } | null>`; `createUser(db: Db, input: { email: string; passwordHash: string }): Promise<{ id: string } | null>` (`null` — email занят).

- [ ] **Step 1: Разделить env** — `lib/env.ts` целиком:

```ts
import { z } from "zod";

// Separate schemas: drizzle-kit and scripts need only the DB URL, not auth secrets.
const dbEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

const authEnvSchema = z.object({
  // Auth.js signs JWTs with this; short secrets are brute-forceable.
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.url(),
  SIGNUP_ALLOWLIST: z.string().default(""),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

// Fail fast on startup instead of on the first query when the env is misconfigured.
export function readDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return dbEnvSchema.parse(source);
}

export function readAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  return authEnvSchema.parse(source);
}
```

В `db/client.ts` и `drizzle.config.ts` заменить `readServerEnv` на `readDbEnv`.

- [ ] **Step 2: Схема** — `db/schema.ts` целиком (через `/db-change`, шаги 1–2 навыка):

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative import: drizzle-kit loads this file outside the Next/Vitest alias resolution.
import { ACTIVITY_LEVELS, GOALS, SEXES, TARGET_MODES } from "../lib/config";

export const sexEnum = pgEnum("sex", SEXES);
export const activityLevelEnum = pgEnum("activity_level", ACTIVITY_LEVELS);
export const goalEnum = pgEnum("goal", GOALS);
export const targetModeEnum = pgEnum("target_mode", TARGET_MODES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const nutrient = (name: string) => numeric(name, { precision: 8, scale: 2, mode: "number" }).notNull();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored lowercased by the app, so a plain unique index is enough.
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const profiles = pgTable("profiles", {
  // One profile per user, so the user id is the key and its own index.
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  sex: sexEnum("sex").notNull(),
  birthDate: date("birth_date").notNull(),
  heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }).notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1, mode: "number" }).notNull(),
  activityLevel: activityLevelEnum("activity_level").notNull(),
  goal: goalEnum("goal").notNull(),
  updatedAt: updatedAt(),
});

export const targets = pgTable(
  "targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mode: targetModeEnum("mode").notNull(),
    kcal: nutrient("kcal"),
    proteinG: nutrient("protein_g"),
    fatG: nutrient("fat_g"),
    carbsG: nutrient("carbs_g"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("targets_user_id_idx").on(t.userId),
    // Exactly one default target per user; also the ON CONFLICT target for upserts.
    uniqueIndex("targets_one_default_per_user")
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
);
```

- [ ] **Step 3: Сгенерировать миграцию** — `pnpm db:generate`. Показать пользователю SQL целиком, отметить риски (таблицы новые, данных нет → риска потери нет). **ОСТАНОВИТЬСЯ и ждать «ок».**

- [ ] **Step 4: После «ок»** — `pnpm db:migrate` (dev-база). Ожидание: `migrations applied successfully`.

- [ ] **Step 5: Тип `Db`** — `db/types.ts`:

```ts
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

// The common base of the client and its transactions, so repos work inside db.transaction().
export type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
```

- [ ] **Step 6: Инфраструктура тестовой БД** — `tests/global-setup.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Runs once per `vitest run`: brings the test database to the latest migration.
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
  await client.end();
}
```

`tests/db.ts`:

```ts
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");

const client = postgres(url, { max: 1, onnotice: () => {} });
export const testDb: Db = drizzle(client, { schema });

// Every user-owned table cascades from users, so one truncate clears the whole state.
export async function resetDb(): Promise<void> {
  await testDb.execute(sql`TRUNCATE users CASCADE`);
}

export async function closeTestDb(): Promise<void> {
  await client.end();
}
```

`vitest.config.ts` целиком:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest only exposes VITE_* vars by default; DB tests need DATABASE_URL_TEST from .env.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["**/*.db.test.ts", "node_modules/**", ".next/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["**/*.db.test.ts"],
          globalSetup: ["tests/global-setup.ts"],
          // Files share one database and truncate it, so they must not run concurrently.
          fileParallelism: false,
        },
      },
    ],
  },
});
```

В `package.json` добавить скрипт `"test:unit": "vitest run --project unit"`.

- [ ] **Step 7: Падающий тест репозитория пользователей** — `lib/users/repo.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createUser, findUserByEmail } from "./repo";

beforeEach(resetDb);
afterAll(closeTestDb);

describe("users repo", () => {
  it("creates a user and finds it by email", async () => {
    const created = await createUser(testDb, { email: "me@example.com", passwordHash: "h" });
    expect(created?.id).toEqual(expect.any(String));
    expect(await findUserByEmail(testDb, "me@example.com")).toEqual({
      id: created?.id,
      passwordHash: "h",
    });
  });

  it("returns null instead of throwing when the email is taken", async () => {
    await createUser(testDb, { email: "me@example.com", passwordHash: "h1" });
    expect(await createUser(testDb, { email: "me@example.com", passwordHash: "h2" })).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await findUserByEmail(testDb, "nobody@example.com")).toBeNull();
  });
});
```

Run: `pnpm exec vitest run --project db` → FAIL (`./repo` not found).

- [ ] **Step 8: Реализовать `lib/users/repo.ts`**

```ts
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Db } from "@/db/types";

export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const [row] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

// A taken email yields null rather than a unique-violation error, so sign-up can answer generically.
export async function createUser(
  db: Db,
  input: { email: string; passwordHash: string },
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(users)
    .values(input)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  return row ?? null;
}
```

Run: `pnpm test && pnpm lint` → PASS (оба проекта).

- [ ] **Step 9: CI с Postgres** — в `.github/workflows/ci.yml` у job `lint-and-test` добавить:

```yaml
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: bitewise
          POSTGRES_PASSWORD: bitewise
          POSTGRES_DB: bitewise_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U bitewise"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
    env:
      DATABASE_URL_TEST: postgres://bitewise:bitewise@localhost:5432/bitewise_test
```

- [ ] **Step 10: Документация** — в `docs/ru/architecture.md`, таблица «Модель данных»: строки `users`, `profiles`, `targets` заменить на фактические поля из Step 2 (включая `password_hash`, `weight_kg`, `mode`, частичный уникальный индекс).

- [ ] **Step 11: Commit**

```bash
git add db lib/env.ts lib/users drizzle.config.ts vitest.config.ts package.json tests .github docs/ru/architecture.md
git commit -m "feat: add users, profiles and targets tables with test database setup"
```

---

### Task 4: Валидация форм и тексты

**Files:**
- Modify: `lib/i18n/ru.ts`
- Create: `lib/forms.ts`, `lib/forms.test.ts`, `lib/auth/allowlist.ts`, `lib/auth/allowlist.test.ts`, `lib/auth/schema.ts`, `lib/auth/schema.test.ts`, `lib/profile/schema.ts`, `lib/profile/schema.test.ts`, `lib/targets/schema.ts`, `lib/targets/schema.test.ts`

**Interfaces:**
- Consumes: `PROFILE_LIMITS`, `TARGET_LIMITS`, `AUTH`, enum-кортежи; `calcAgeYears`, `ProfileData`, `MacroTargets`; `parseIsoDate`, `IsoDate`.
- Produces:
  - `ru` (полный объект ниже).
  - `lib/forms.ts`: `type FormState = { fieldErrors?: Record<string, string>; formError?: string }`; `firstFieldErrors(error: z.ZodError): Record<string, string>`; `decimalField(limits: { min: number; max: number }, message: string)`.
  - `lib/auth/allowlist.ts`: `normalizeEmail(email: string): string`; `parseAllowlist(raw: string): Set<string>`; `isEmailAllowed(email: string, allowlist: Set<string>): boolean`.
  - `lib/auth/schema.ts`: `credentialsSchema` → `{ email: string; password: string }` (email уже нормализован).
  - `lib/profile/schema.ts`: `makeProfileSchema(today: IsoDate)` → `ProfileData`.
  - `lib/targets/schema.ts`: `targetsSchema` → `MacroTargets`.

- [ ] **Step 1: Тексты** — `lib/i18n/ru.ts` целиком:

```ts
// Single source of UI strings so screens never hardcode Russian text in JSX.
// Range messages take limits from config, so the text cannot drift from validation.
export const ru = {
  app: {
    name: "Bitewise",
    description: "Дневник еды и калорий",
  },
  common: {
    loading: "Загрузка…",
    errorTitle: "Что-то пошло не так",
    retry: "Попробовать снова",
    save: "Сохранить",
  },
  auth: {
    email: "Email",
    password: "Пароль",
    loginTitle: "Вход",
    loginSubmit: "Войти",
    toRegister: "Нет аккаунта? Зарегистрироваться",
    registerTitle: "Регистрация",
    registerSubmit: "Создать аккаунт",
    toLogin: "Уже есть аккаунт? Войти",
    signOut: "Выйти",
    invalidCredentials: "Неверный email или пароль",
    registerUnavailable: "Регистрация для этого email недоступна",
    tooManyAttempts: "Слишком много попыток. Попробуйте позже",
  },
  profile: {
    onboardingTitle: "Расскажите о себе",
    onboardingHint: "По этим данным посчитаем норму калорий и БЖУ.",
    editTitle: "Профиль",
    sex: "Пол",
    sexes: { male: "Мужской", female: "Женский" },
    birthDate: "Дата рождения",
    heightCm: "Рост, см",
    weightKg: "Вес, кг",
    activityLevel: "Активность",
    activityLevels: {
      sedentary: { label: "Минимальная", hint: "Сидячая работа, без тренировок" },
      light: { label: "Лёгкая", hint: "1–3 тренировки в неделю" },
      moderate: { label: "Средняя", hint: "3–5 тренировок в неделю" },
      active: { label: "Высокая", hint: "6–7 тренировок в неделю" },
      veryActive: { label: "Очень высокая", hint: "Физическая работа или 2 тренировки в день" },
    },
    goal: "Цель",
    goals: { lose: "Похудеть", maintain: "Держать вес", gain: "Набрать" },
    submitOnboarding: "Посчитать норму",
  },
  targets: {
    defaultName: "По умолчанию",
    cardTitle: "Норма на день",
    kcalUnit: "ккал",
    gramsUnit: "г",
    protein: "Белки",
    fat: "Жиры",
    carbs: "Углеводы",
    modes: { auto: "авто", manual: "вручную" },
    editProfile: "Изменить профиль",
    editTargets: "Изменить норму",
    editTitle: "Норма",
    kcal: "Калории, ккал",
    proteinG: "Белки, г",
    fatG: "Жиры, г",
    carbsG: "Углеводы, г",
    calculatedHint: "Расчётная",
    resetToAuto: "Вернуть расчётную",
  },
  errors: {
    email: "Введите корректный email",
    passwordLength: (min: number, max: number) => `Пароль — от ${min} до ${max} символов`,
    choose: "Выберите вариант",
    date: "Введите корректную дату",
    ageRange: (min: number, max: number) => `Возраст — от ${min} до ${max} лет`,
    heightRange: (min: number, max: number) => `Рост — от ${min} до ${max} см`,
    weightRange: (min: number, max: number) => `Вес — от ${min} до ${max} кг`,
    kcalRange: (min: number, max: number) => `Калории — от ${min} до ${max} ккал`,
    gramsRange: (min: number, max: number) => `От ${min} до ${max} г`,
  },
  home: {
    tagline: "Быстро записывай, что съел, и смотри, сколько осталось до нормы.",
  },
} as const;
```

- [ ] **Step 2: Падающие тесты хелперов и allowlist** — `lib/forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decimalField, firstFieldErrors } from "./forms";

describe("decimalField", () => {
  const field = decimalField({ min: 30, max: 300 }, "bad");

  it("accepts a decimal comma from a Russian keyboard", () => {
    expect(field.parse("80,5")).toBe(80.5);
  });

  it("accepts a dot and surrounding spaces", () => {
    expect(field.parse(" 80.5 ")).toBe(80.5);
  });

  it.each(["", "  ", "abc", "29.9", "300.1"])("rejects %j", (value) => {
    expect(field.safeParse(value).success).toBe(false);
  });

  it("accepts the limits themselves", () => {
    expect(field.parse("30")).toBe(30);
    expect(field.parse("300")).toBe(300);
  });
});

describe("firstFieldErrors", () => {
  it("keeps only the first message per field", () => {
    const schema = z.object({ a: z.string().min(2, "short").email("email"), b: z.string() });
    const result = schema.safeParse({ a: "x", b: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = firstFieldErrors(result.error);
    expect(errors.a).toBe("short");
    expect(errors.b).toEqual(expect.any(String));
  });
});
```

`lib/auth/allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isEmailAllowed, normalizeEmail, parseAllowlist } from "./allowlist";

describe("allowlist", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Me@Mail.COM ")).toBe("me@mail.com");
  });

  it("parses a comma-separated list, ignoring blanks", () => {
    expect(parseAllowlist(" A@x.io, ,b@y.io ,")).toEqual(new Set(["a@x.io", "b@y.io"]));
  });

  it("matches emails regardless of case and spaces", () => {
    expect(isEmailAllowed(" A@X.io", parseAllowlist("a@x.io"))).toBe(true);
  });

  it("allows nobody when the list is empty", () => {
    expect(isEmailAllowed("a@x.io", parseAllowlist(""))).toBe(false);
  });
});
```

Run: `pnpm exec vitest run lib/forms.test.ts lib/auth/allowlist.test.ts` → FAIL.

- [ ] **Step 3: Реализовать** — `lib/forms.ts`:

```ts
import { z } from "zod";

export type FormState = { fieldErrors?: Record<string, string>; formError?: string };

export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string[] | undefined> = z.flattenError(error).fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
}

// Russian phone keyboards type "80,5"; an empty field must fail rather than coerce to 0.
export function decimalField(limits: { min: number; max: number }, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed.replace(",", ".");
    },
    z.coerce
      .number({ error: message })
      .min(limits.min, { error: message })
      .max(limits.max, { error: message }),
  );
}
```

`lib/auth/allowlist.ts`:

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowlist(raw: string): Set<string> {
  return new Set(raw.split(",").map(normalizeEmail).filter(Boolean));
}

export function isEmailAllowed(email: string, allowlist: Set<string>): boolean {
  return allowlist.has(normalizeEmail(email));
}
```

Run: те же тесты → PASS.

- [ ] **Step 4: Падающие тесты схем** — `lib/auth/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { credentialsSchema } from "./schema";

describe("credentialsSchema", () => {
  it("normalizes the email", () => {
    expect(credentialsSchema.parse({ email: "  Me@Mail.com ", password: "12345678" }).email).toBe(
      "me@mail.com",
    );
  });

  it.each([
    { email: "not-an-email", password: "12345678" },
    { email: "me@mail.com", password: "1234567" },
    { email: "me@mail.com", password: "x".repeat(129) },
    {},
  ])("rejects %j", (input) => {
    expect(credentialsSchema.safeParse(input).success).toBe(false);
  });
});
```

`lib/profile/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeProfileSchema } from "./schema";

const schema = makeProfileSchema("2026-10-09");
const valid = {
  sex: "female",
  birthDate: "1996-03-15",
  heightCm: "165",
  weightKg: "60,5",
  activityLevel: "light",
  goal: "lose",
};

describe("profile schema", () => {
  it("parses form strings into profile data", () => {
    expect(schema.parse(valid)).toEqual({ ...valid, heightCm: 165, weightKg: 60.5 });
  });

  it.each([
    ["sex", "other"],
    ["activityLevel", "extreme"],
    ["goal", ""],
    ["birthDate", "2026-02-30"],
    ["birthDate", "2027-01-01"],
    ["birthDate", "2013-10-10"], // 12 years old
    ["birthDate", "1925-01-01"], // 101 years old
    ["heightCm", "99"],
    ["weightKg", ""],
  ])("reports an error on %s = %j", (field, value) => {
    const result = schema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });

  it("accepts exactly 14 years old", () => {
    expect(schema.safeParse({ ...valid, birthDate: "2012-10-09" }).success).toBe(true);
  });
});
```

`lib/targets/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { targetsSchema } from "./schema";

describe("targets schema", () => {
  it("parses decimal strings", () => {
    expect(
      targetsSchema.parse({ kcal: "2200", proteinG: "140,5", fatG: "70", carbsG: "0" }),
    ).toEqual({ kcal: 2200, proteinG: 140.5, fatG: 70, carbsG: 0 });
  });

  it.each([
    ["kcal", "799"],
    ["kcal", "6001"],
    ["proteinG", ""],
    ["fatG", "-1"],
    ["carbsG", "1001"],
  ])("rejects %s = %j", (field, value) => {
    const input = { kcal: "2200", proteinG: "140", fatG: "70", carbsG: "250", [field]: value };
    expect(targetsSchema.safeParse(input).success).toBe(false);
  });
});
```

Run: `pnpm exec vitest run lib/auth/schema.test.ts lib/profile lib/targets` → FAIL.

- [ ] **Step 5: Реализовать схемы** — `lib/auth/schema.ts`:

```ts
import { z } from "zod";
import { AUTH } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

const { min, max } = AUTH.passwordLength;

export const credentialsSchema = z.object({
  email: z.string({ error: ru.errors.email }).trim().toLowerCase().pipe(z.email({ error: ru.errors.email })),
  password: z
    .string({ error: ru.errors.passwordLength(min, max) })
    .min(min, { error: ru.errors.passwordLength(min, max) })
    .max(max, { error: ru.errors.passwordLength(min, max) }),
});
```

`lib/profile/schema.ts`:

```ts
import { z } from "zod";
import { ACTIVITY_LEVELS, GOALS, PROFILE_LIMITS, SEXES } from "@/lib/config";
import { parseIsoDate, type IsoDate } from "@/lib/date";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { calcAgeYears } from "@/lib/nutrition";

const { heightCm, weightKg, ageYears } = PROFILE_LIMITS;

// "today" is an argument so the schema stays deterministic in tests.
export function makeProfileSchema(today: IsoDate) {
  return z.object({
    sex: z.enum(SEXES, { error: ru.errors.choose }),
    birthDate: z.string({ error: ru.errors.date }).superRefine((value, ctx) => {
      if (!parseIsoDate(value)) {
        ctx.addIssue({ code: "custom", message: ru.errors.date });
        return;
      }
      const age = calcAgeYears(value, today);
      if (age < ageYears.min || age > ageYears.max) {
        ctx.addIssue({ code: "custom", message: ru.errors.ageRange(ageYears.min, ageYears.max) });
      }
    }),
    heightCm: decimalField(heightCm, ru.errors.heightRange(heightCm.min, heightCm.max)),
    weightKg: decimalField(weightKg, ru.errors.weightRange(weightKg.min, weightKg.max)),
    activityLevel: z.enum(ACTIVITY_LEVELS, { error: ru.errors.choose }),
    goal: z.enum(GOALS, { error: ru.errors.choose }),
  });
}
```

`lib/targets/schema.ts`:

```ts
import { z } from "zod";
import { TARGET_LIMITS } from "@/lib/config";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

const { kcal, macroG } = TARGET_LIMITS;
const grams = () => decimalField(macroG, ru.errors.gramsRange(macroG.min, macroG.max));

export const targetsSchema = z.object({
  kcal: decimalField(kcal, ru.errors.kcalRange(kcal.min, kcal.max)),
  proteinG: grams(),
  fatG: grams(),
  carbsG: grams(),
});
```

Run: `pnpm test && pnpm lint` → PASS. (Если `app/page.tsx` ссылается на удалённый `ru.home.comingSoon`, удалить эту строку из страницы — главная перепишется в задаче 8.)

- [ ] **Step 6: Commit**

```bash
git add lib app
git commit -m "feat: add form validation schemas and UI strings for auth and profile"
```

---

### Task 5: Регистрация и вход — логика

**Files:**
- Create: `lib/auth/authorize.ts`, `lib/auth/authorize.test.ts`, `lib/auth/register.ts`, `lib/auth/register.test.ts`

**Interfaces:**
- Consumes: `credentialsSchema`, `RateLimiter`, `isEmailAllowed`, `firstFieldErrors`, `ru`.
- Produces:
  - `type AuthorizeDeps = { findUserByEmail(email: string): Promise<{ id: string; passwordHash: string } | null>; verifyPassword(password: string, stored: string): Promise<boolean>; getDummyPasswordHash(): Promise<string>; limiter: RateLimiter; nowMs: number }`.
  - `authorizeCredentials(raw: unknown, ip: string, deps: AuthorizeDeps): Promise<{ id: string; email: string } | null>`.
  - `type RegisterDeps = { allowlist: Set<string>; limiter: RateLimiter; nowMs: number; hashPassword(password: string): Promise<string>; createUser(email: string, passwordHash: string): Promise<{ id: string } | null> }`.
  - `type RegisterResult = { ok: true } | { ok: false; fieldErrors?: Record<string, string>; formError?: string }`.
  - `registerUser(raw: unknown, ip: string, deps: RegisterDeps): Promise<RegisterResult>`.

- [ ] **Step 1: Падающие тесты** — `lib/auth/authorize.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { authorizeCredentials, type AuthorizeDeps } from "./authorize";
import { createRateLimiter } from "./rate-limit";

function makeDeps(overrides: Partial<AuthorizeDeps> = {}): AuthorizeDeps {
  return {
    findUserByEmail: async (email) =>
      email === "me@mail.com" ? { id: "u1", passwordHash: "stored" } : null,
    verifyPassword: async (password, stored) => stored === "stored" && password === "right-pass",
    getDummyPasswordHash: async () => "dummy",
    limiter: createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 }),
    nowMs: 0,
    ...overrides,
  };
}

describe("authorizeCredentials", () => {
  it("returns the user for correct credentials, normalizing the email", async () => {
    const user = await authorizeCredentials(
      { email: " Me@Mail.com", password: "right-pass" },
      "1.1.1.1",
      makeDeps(),
    );
    expect(user).toEqual({ id: "u1", email: "me@mail.com" });
  });

  it("returns null for a wrong password", async () => {
    const user = await authorizeCredentials(
      { email: "me@mail.com", password: "wrong-pass" },
      "1.1.1.1",
      makeDeps(),
    );
    expect(user).toBeNull();
  });

  it("still runs a password check for unknown emails to keep timing uniform", async () => {
    const verifyPassword = vi.fn(async () => false);
    const user = await authorizeCredentials(
      { email: "nobody@mail.com", password: "right-pass" },
      "1.1.1.1",
      makeDeps({ verifyPassword }),
    );
    expect(user).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("right-pass", "dummy");
  });

  it("returns null for malformed input without touching the database", async () => {
    const findUserByEmail = vi.fn();
    expect(await authorizeCredentials({ email: "x" }, "1.1.1.1", makeDeps({ findUserByEmail }))).toBeNull();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("refuses correct credentials once the rate limit is exhausted", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    const input = { email: "me@mail.com", password: "right-pass" };
    expect(await authorizeCredentials(input, "1.1.1.1", deps)).not.toBeNull();
    expect(await authorizeCredentials(input, "1.1.1.1", deps)).toBeNull();
  });
});
```

`lib/auth/register.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ru } from "@/lib/i18n/ru";
import { createRateLimiter } from "./rate-limit";
import { registerUser, type RegisterDeps } from "./register";

function makeDeps(overrides: Partial<RegisterDeps> = {}): RegisterDeps {
  return {
    allowlist: new Set(["me@mail.com"]),
    limiter: createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 }),
    nowMs: 0,
    hashPassword: async (password) => `hashed:${password}`,
    createUser: async () => ({ id: "u1" }),
    ...overrides,
  };
}

const valid = { email: "  ME@mail.com ", password: "12345678" };

describe("registerUser", () => {
  it("creates an allowlisted user with a normalized email and hashed password", async () => {
    const createUser = vi.fn(async () => ({ id: "u1" }));
    expect(await registerUser(valid, "1.1.1.1", makeDeps({ createUser }))).toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledWith("me@mail.com", "hashed:12345678");
  });

  it("returns field errors for invalid input", async () => {
    const result = await registerUser({ email: "bad", password: "1" }, "1.1.1.1", makeDeps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["email", "password"]);
  });

  it("refuses emails outside the allowlist with the generic message", async () => {
    const createUser = vi.fn();
    const result = await registerUser(
      { email: "other@mail.com", password: "12345678" },
      "1.1.1.1",
      makeDeps({ createUser }),
    );
    expect(result).toEqual({ ok: false, formError: ru.auth.registerUnavailable });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("answers a taken email with the same generic message", async () => {
    const result = await registerUser(valid, "1.1.1.1", makeDeps({ createUser: async () => null }));
    expect(result).toEqual({ ok: false, formError: ru.auth.registerUnavailable });
  });

  it("stops after the rate limit is exhausted", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    await registerUser(valid, "1.1.1.1", deps);
    expect(await registerUser(valid, "1.1.1.1", deps)).toEqual({
      ok: false,
      formError: ru.auth.tooManyAttempts,
    });
  });
});
```

Run: `pnpm exec vitest run lib/auth/authorize.test.ts lib/auth/register.test.ts` → FAIL.

- [ ] **Step 2: Реализовать** — `lib/auth/authorize.ts`:

```ts
import type { RateLimiter } from "./rate-limit";
import { credentialsSchema } from "./schema";

export type AuthorizeDeps = {
  findUserByEmail(email: string): Promise<{ id: string; passwordHash: string } | null>;
  verifyPassword(password: string, stored: string): Promise<boolean>;
  getDummyPasswordHash(): Promise<string>;
  limiter: RateLimiter;
  nowMs: number;
};

// Every failure returns null so the caller shows one message and leaks nothing about why.
export async function authorizeCredentials(
  raw: unknown,
  ip: string,
  deps: AuthorizeDeps,
): Promise<{ id: string; email: string } | null> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  // Both keys are limited: per IP stops spraying many accounts, per email stops distributed guessing.
  const ipAllowed = deps.limiter.hit(`ip:${ip}`, deps.nowMs);
  const emailAllowed = deps.limiter.hit(`email:${email}`, deps.nowMs);
  if (!ipAllowed || !emailAllowed) return null;

  const user = await deps.findUserByEmail(email);
  const stored = user?.passwordHash ?? (await deps.getDummyPasswordHash());
  const passwordOk = await deps.verifyPassword(password, stored);
  return user && passwordOk ? { id: user.id, email } : null;
}
```

`lib/auth/register.ts`:

```ts
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { isEmailAllowed } from "./allowlist";
import type { RateLimiter } from "./rate-limit";
import { credentialsSchema } from "./schema";

export type RegisterDeps = {
  allowlist: Set<string>;
  limiter: RateLimiter;
  nowMs: number;
  hashPassword(password: string): Promise<string>;
  createUser(email: string, passwordHash: string): Promise<{ id: string } | null>;
};

export type RegisterResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

export async function registerUser(
  raw: unknown,
  ip: string,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  if (!deps.limiter.hit(`ip:${ip}`, deps.nowMs)) {
    return { ok: false, formError: ru.auth.tooManyAttempts };
  }
  // Not allowlisted and already taken share one message, so sign-up cannot probe for accounts.
  if (!isEmailAllowed(email, deps.allowlist)) {
    return { ok: false, formError: ru.auth.registerUnavailable };
  }
  const created = await deps.createUser(email, await deps.hashPassword(password));
  return created ? { ok: true } : { ok: false, formError: ru.auth.registerUnavailable };
}
```

Run: `pnpm test && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/auth
git commit -m "feat: add credential authorization and allowlisted sign-up logic"
```

---

### Task 6: Профиль и норма — репозитории

**Files:**
- Create: `lib/targets/repo.ts`, `lib/profile/repo.ts`, `lib/profile/repo.db.test.ts`

**Interfaces:**
- Consumes: `Db`, `profiles`, `targets`, `calcAutoTargets`, `ProfileData`, `MacroTargets`, `TargetMode`, `IsoDate`, `ru.targets.defaultName`, `testDb`, `resetDb`, `closeTestDb`, `createUser`.
- Produces:
  - `lib/targets/repo.ts`: `type DefaultTarget = MacroTargets & { mode: TargetMode }`; `getDefaultTarget(db: Db, userId: string): Promise<DefaultTarget | null>`; `upsertDefaultTarget(db: Db, userId: string, values: MacroTargets, mode: TargetMode): Promise<void>`; `setManualTarget(db: Db, userId: string, values: MacroTargets): Promise<void>`.
  - `lib/profile/repo.ts`: `getProfile(db: Db, userId: string): Promise<ProfileData | null>`; `saveProfile(db: Db, userId: string, profile: ProfileData, today: IsoDate): Promise<void>`; `resetTargetToAuto(db: Db, userId: string, today: IsoDate): Promise<boolean>` (`false` — профиля нет).

- [ ] **Step 1: Падающие интеграционные тесты** — `lib/profile/repo.db.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ProfileData } from "@/lib/nutrition";
import { getDefaultTarget, setManualTarget } from "@/lib/targets/repo";
import { createUser } from "@/lib/users/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { getProfile, resetTargetToAuto, saveProfile } from "./repo";

const TODAY = "2026-10-09";
const profile: ProfileData = {
  sex: "male",
  birthDate: "1996-03-15",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};
const manual = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 210 };

async function newUserId(email: string): Promise<string> {
  const user = await createUser(testDb, { email, passwordHash: "h" });
  if (!user) throw new Error("user not created");
  return user.id;
}

beforeEach(resetDb);
afterAll(closeTestDb);

describe("saveProfile", () => {
  it("stores the profile and creates an auto default target", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);

    expect(await getProfile(testDb, userId)).toEqual(profile);
    const target = await getDefaultTarget(testDb, userId);
    // numeric(8,2) rounds 82.77 / 359.5175 on write.
    expect(target).toEqual({ mode: "auto", kcal: 2759, proteinG: 144, fatG: 82.77, carbsG: 359.52 });
  });

  it("recalculates an auto target when the profile changes", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await saveProfile(testDb, userId, { ...profile, goal: "lose" }, TODAY);

    expect((await getDefaultTarget(testDb, userId))?.kcal).toBeCloseTo(2345.15, 2);
  });

  it("leaves a manual target untouched when the profile changes", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await setManualTarget(testDb, userId, manual);
    await saveProfile(testDb, userId, { ...profile, weightKg: 70 }, TODAY);

    expect(await getDefaultTarget(testDb, userId)).toEqual({ mode: "manual", ...manual });
    expect((await getProfile(testDb, userId))?.weightKg).toBe(70);
  });
});

describe("resetTargetToAuto", () => {
  it("switches a manual target back to calculated values", async () => {
    const userId = await newUserId("a@mail.com");
    await saveProfile(testDb, userId, profile, TODAY);
    await setManualTarget(testDb, userId, manual);

    expect(await resetTargetToAuto(testDb, userId, TODAY)).toBe(true);
    expect(await getDefaultTarget(testDb, userId)).toMatchObject({ mode: "auto", kcal: 2759 });
  });

  it("returns false when the user has no profile yet", async () => {
    const userId = await newUserId("a@mail.com");
    expect(await resetTargetToAuto(testDb, userId, TODAY)).toBe(false);
  });
});

describe("user isolation", () => {
  it("never returns or changes another user's data", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    await saveProfile(testDb, alice, profile, TODAY);

    expect(await getProfile(testDb, bob)).toBeNull();
    expect(await getDefaultTarget(testDb, bob)).toBeNull();

    await setManualTarget(testDb, bob, manual);
    expect((await getDefaultTarget(testDb, alice))?.mode).toBe("auto");
  });
});
```

Run: `pnpm exec vitest run --project db` → FAIL (modules not found).

- [ ] **Step 2: Реализовать** — `lib/targets/repo.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import { targets } from "@/db/schema";
import type { Db } from "@/db/types";
import type { TargetMode } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import type { MacroTargets } from "@/lib/nutrition";

export type DefaultTarget = MacroTargets & { mode: TargetMode };

export async function getDefaultTarget(db: Db, userId: string): Promise<DefaultTarget | null> {
  const [row] = await db
    .select({
      mode: targets.mode,
      kcal: targets.kcal,
      proteinG: targets.proteinG,
      fatG: targets.fatG,
      carbsG: targets.carbsG,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.isDefault, true)))
    .limit(1);
  return row ?? null;
}

// Relies on the partial unique index (user_id) WHERE is_default as the conflict target.
export async function upsertDefaultTarget(
  db: Db,
  userId: string,
  values: MacroTargets,
  mode: TargetMode,
): Promise<void> {
  await db
    .insert(targets)
    .values({ userId, name: ru.targets.defaultName, isDefault: true, mode, ...values })
    .onConflictDoUpdate({
      target: targets.userId,
      targetWhere: sql`${targets.isDefault}`,
      set: { mode, ...values, updatedAt: sql`now()` },
    });
}

export async function setManualTarget(db: Db, userId: string, values: MacroTargets): Promise<void> {
  await upsertDefaultTarget(db, userId, values, "manual");
}
```

`lib/profile/repo.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { profiles } from "@/db/schema";
import type { Db } from "@/db/types";
import type { IsoDate } from "@/lib/date";
import { calcAutoTargets, type ProfileData } from "@/lib/nutrition";
import { getDefaultTarget, upsertDefaultTarget } from "@/lib/targets/repo";

export async function getProfile(db: Db, userId: string): Promise<ProfileData | null> {
  const [row] = await db
    .select({
      sex: profiles.sex,
      birthDate: profiles.birthDate,
      heightCm: profiles.heightCm,
      weightKg: profiles.weightKg,
      activityLevel: profiles.activityLevel,
      goal: profiles.goal,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

// One transaction: a profile must never exist without its default target, and a manual
// target is the user's explicit choice, so a profile edit must not overwrite it.
export async function saveProfile(
  db: Db,
  userId: string,
  profile: ProfileData,
  today: IsoDate,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...profile })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...profile, updatedAt: sql`now()` } });
    const current = await getDefaultTarget(tx, userId);
    if (current?.mode === "manual") return;
    await upsertDefaultTarget(tx, userId, calcAutoTargets(profile, today), "auto");
  });
}

export async function resetTargetToAuto(db: Db, userId: string, today: IsoDate): Promise<boolean> {
  const profile = await getProfile(db, userId);
  if (!profile) return false;
  await upsertDefaultTarget(db, userId, calcAutoTargets(profile, today), "auto");
  return true;
}
```

Run: `pnpm test && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/profile lib/targets
git commit -m "feat: persist profile and keep default target in sync with its mode"
```

---

### Task 7: Подключение Auth.js v4

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `lib/auth/options.ts`, `lib/auth/session.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `authorizeCredentials`, `findUserByEmail`, `verifyPassword`, `getDummyPasswordHash`, `loginLimiter`, `clientIpFromForwardedFor`, `readAuthEnv`, `AUTH`, `db`.
- Produces: `authOptions: NextAuthOptions`; `getSessionUserId(): Promise<string | null>`; `requireUserId(): Promise<string>` (redirect на `/login` без сессии); `session.user.id: string` в типах.

- [ ] **Step 1: Зависимость** — `pnpm add next-auth@4`. Проверить `node_modules/next-auth/package.json` → `peerDependencies.next` включает `^16`.

- [ ] **Step 2: Типы** — `types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";

// The session carries only the user id; everything else is loaded from the database.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

- [ ] **Step 3: Опции** — `lib/auth/options.ts`:

```ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { AUTH } from "@/lib/config";
import { readAuthEnv } from "@/lib/env";
import { findUserByEmail } from "@/lib/users/repo";
import { authorizeCredentials } from "./authorize";
import { loginLimiter } from "./limiters";
import { getDummyPasswordHash, verifyPassword } from "./password";
import { clientIpFromForwardedFor } from "./request";

const env = readAuthEnv();

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  // Credentials in Auth.js only work with JWT sessions.
  session: { strategy: "jwt", maxAge: AUTH.sessionMaxAgeSec },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, req) {
        const forwardedFor = req.headers?.["x-forwarded-for"];
        const ip = clientIpFromForwardedFor(typeof forwardedFor === "string" ? forwardedFor : null);
        return authorizeCredentials(credentials, ip, {
          findUserByEmail: (email) => findUserByEmail(db, email),
          verifyPassword,
          getDummyPasswordHash,
          limiter: loginLimiter,
          nowMs: Date.now(),
        });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      return { ...session, user: { id: token.sub ?? "" } };
    },
  },
};
```

- [ ] **Step 4: Хелперы сессии** — `lib/auth/session.ts`:

```ts
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user.id || null;
}

// Pages and server actions call this first; layouts do not, because with cacheComponents
// a session read at the top of a layout would block the whole segment.
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}
```

- [ ] **Step 5: Route handler** — `app/api/auth/[...nextauth]/route.ts`:

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

// The only route without a session check: it is where sessions are created.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 6: Проверка** — `pnpm lint && pnpm test` → PASS; `pnpm dev`, затем `curl -s localhost:3000/api/auth/providers` → JSON с `"credentials"`; `curl -s localhost:3000/api/auth/csrf` → `{"csrfToken":...}`. Если Next 16 ругается на `params` в обработчике next-auth — остановиться и сообщить пользователю (не писать обходы вслепую).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/auth types app/api
git commit -m "feat: wire Auth.js v4 credentials provider with JWT sessions"
```

---

### Task 8: Экраны входа и регистрации

**Files:**
- Create: `components/ui/form.tsx`, `components/auth/login-form.tsx`, `components/auth/register-form.tsx`, `components/auth/sign-out-button.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/register/actions.ts`

**Interfaces:**
- Consumes: `registerUser`, `RegisterResult`, `registerLimiter`, `hashPassword`, `createUser`, `parseAllowlist`, `readAuthEnv`, `clientIpFromForwardedFor`, `db`, `ru`, `FormState`.
- Produces:
  - `components/ui/form.tsx`: `TextField`, `ChoiceGroup`, `SubmitButton`, `FormError`, `usePreservingFormAction<S>(action: (prev: S, formData: FormData) => Promise<S>, initial: S): { state: S; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }`.
  - `registerAction(formData: FormData): Promise<RegisterResult>`.
  - `SignOutButton`.

- [ ] **Step 1: UI-примитивы форм** — `components/ui/form.tsx`:

```tsx
"use client";

import {
  startTransition,
  useActionState,
  useId,
  type FormEvent,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from "react";

// React 19 resets a form after a `form action` runs, wiping input on validation errors;
// submitting through onSubmit + startTransition keeps what the user typed.
export function usePreservingFormAction<S>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initial: S,
) {
  const [state, formAction, pending] = useActionState(action, initial);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }
  return { state, pending, onSubmit };
}

type TextFieldProps = {
  label: string;
  name: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: "text" | "decimal" | "email";
  autoComplete?: string;
  defaultValue?: string | number;
  error?: string;
};

export function TextField({
  label,
  name,
  type = "text",
  inputMode,
  autoComplete,
  defaultValue,
  error,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-lg border border-foreground/20 bg-background px-3 text-base"
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type ChoiceOption<T extends string> = { value: T; label: string; hint?: string };

export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  defaultValue,
  error,
  layout = "column",
}: {
  legend: string;
  name: string;
  options: readonly ChoiceOption<T>[];
  defaultValue?: T;
  error?: string;
  layout?: "row" | "column";
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className={layout === "row" ? "grid auto-cols-fr grid-flow-col gap-2" : "flex flex-col gap-2"}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border border-foreground/20 px-3 py-2 has-[:checked]:border-foreground has-[:checked]:bg-foreground/5 has-[:focus-visible]:ring-2"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="sr-only"
            />
            <span className="text-base">{option.label}</span>
            {option.hint ? <span className="text-sm text-foreground/60">{option.hint}</span> : null}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </fieldset>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg bg-foreground px-4 font-medium text-background disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  ) : null;
}
```

- [ ] **Step 2: Действие регистрации** — `app/(auth)/register/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { db } from "@/db/client";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { registerLimiter } from "@/lib/auth/limiters";
import { hashPassword } from "@/lib/auth/password";
import { registerUser, type RegisterResult } from "@/lib/auth/register";
import { clientIpFromForwardedFor } from "@/lib/auth/request";
import { readAuthEnv } from "@/lib/env";
import { createUser } from "@/lib/users/repo";

// Public by design: there is no session before sign-up. Abuse is bounded by the allowlist
// and the per-IP rate limit inside registerUser.
export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = clientIpFromForwardedFor((await headers()).get("x-forwarded-for"));
  return registerUser(Object.fromEntries(formData), ip, {
    allowlist: parseAllowlist(readAuthEnv().SIGNUP_ALLOWLIST),
    limiter: registerLimiter,
    nowMs: Date.now(),
    hashPassword,
    createUser: (email, passwordHash) => createUser(db, { email, passwordHash }),
  });
}
```

- [ ] **Step 3: Клиентские формы** — `components/auth/login-form.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { ru } from "@/lib/i18n/ru";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      if (!result?.ok) {
        setError(ru.auth.invalidCredentials);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField label={ru.auth.email} name="email" type="email" inputMode="email" autoComplete="email" />
      <TextField label={ru.auth.password} name="password" type="password" autoComplete="current-password" />
      <FormError message={error} />
      <SubmitButton pending={pending}>{ru.auth.loginSubmit}</SubmitButton>
      <Link href="/register" className="flex min-h-11 items-center justify-center text-sm underline">
        {ru.auth.toRegister}
      </Link>
    </form>
  );
}
```

`components/auth/register-form.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { registerAction } from "@/app/(auth)/register/actions";
import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import type { RegisterResult } from "@/lib/auth/register";
import { ru } from "@/lib/i18n/ru";

export function RegisterForm() {
  const router = useRouter();
  const [result, setResult] = useState<RegisterResult>();
  const [pending, setPending] = useState(false);
  const failure = result && !result.ok ? result : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const registered = await registerAction(formData);
      setResult(registered);
      if (!registered.ok) return;
      const signedIn = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      router.push(signedIn?.ok ? "/onboarding" : "/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label={ru.auth.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        error={failure?.fieldErrors?.email}
      />
      <TextField
        label={ru.auth.password}
        name="password"
        type="password"
        autoComplete="new-password"
        error={failure?.fieldErrors?.password}
      />
      <FormError message={failure?.formError} />
      <SubmitButton pending={pending}>{ru.auth.registerSubmit}</SubmitButton>
      <Link href="/login" className="flex min-h-11 items-center justify-center text-sm underline">
        {ru.auth.toLogin}
      </Link>
    </form>
  );
}
```

`components/auth/sign-out-button.tsx`:

```tsx
"use client";

import { signOut } from "next-auth/react";
import { ru } from "@/lib/i18n/ru";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="min-h-11 rounded-lg border border-foreground/20 px-4"
    >
      {ru.auth.signOut}
    </button>
  );
}
```

- [ ] **Step 4: Страницы** — `app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";
import { ru } from "@/lib/i18n/ru";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{ru.auth.loginTitle}</h1>
      <LoginForm />
    </main>
  );
}
```

`app/(auth)/register/page.tsx`:

```tsx
import { RegisterForm } from "@/components/auth/register-form";
import { ru } from "@/lib/i18n/ru";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{ru.auth.registerTitle}</h1>
      <RegisterForm />
    </main>
  );
}
```

- [ ] **Step 5: Проверка** — `pnpm lint && pnpm test` → PASS; `pnpm dev`: `/register` с email из `SIGNUP_ALLOWLIST` → редирект на `/onboarding` (пока 404 — экран в задаче 9); `/login` с неверным паролем → «Неверный email или пароль»; email вне списка → «Регистрация для этого email недоступна».

- [ ] **Step 6: Commit**

```bash
git add components app/\(auth\)
git commit -m "feat: add login and sign-up screens"
```

---

### Task 9: Онбординг, главная, профиль и норма

**Files:**
- Delete: `app/page.tsx`
- Create: `app/(app)/page.tsx`, `app/(app)/onboarding/page.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/targets/page.tsx`, `app/(app)/actions.ts`, `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `components/profile/profile-form.tsx`, `components/targets/targets-form.tsx`

**Interfaces:**
- Consumes: `requireUserId`, `db`, `getProfile`, `saveProfile`, `resetTargetToAuto`, `getDefaultTarget`, `setManualTarget`, `makeProfileSchema`, `targetsSchema`, `firstFieldErrors`, `FormState`, `todayIsoDate`, `calcAutoTargets`, `formatKcal`, `formatGrams`, UI-примитивы, `SignOutButton`, `ru`.
- Produces: `saveProfileAction(prev: FormState, formData: FormData): Promise<FormState>`; `saveManualTargetAction(prev: FormState, formData: FormData): Promise<FormState>`; `resetTargetAction(): Promise<void>`.

- [ ] **Step 1: Server actions** — `app/(app)/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireUserId } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/date";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { resetTargetToAuto, saveProfile } from "@/lib/profile/repo";
import { makeProfileSchema } from "@/lib/profile/schema";
import { setManualTarget } from "@/lib/targets/repo";
import { targetsSchema } from "@/lib/targets/schema";

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const today = todayIsoDate(new Date());
  const parsed = makeProfileSchema(today).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  await saveProfile(db, userId, parsed.data, today);
  redirect("/");
}

export async function saveManualTargetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = targetsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  await setManualTarget(db, userId, parsed.data);
  redirect("/");
}

export async function resetTargetAction(): Promise<void> {
  const userId = await requireUserId();
  const reset = await resetTargetToAuto(db, userId, todayIsoDate(new Date()));
  redirect(reset ? "/" : "/onboarding");
}
```

- [ ] **Step 2: Формы** — `components/profile/profile-form.tsx`:

```tsx
"use client";

import { saveProfileAction } from "@/app/(app)/actions";
import { ChoiceGroup, FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { ACTIVITY_LEVELS, GOALS, SEXES } from "@/lib/config";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { ProfileData } from "@/lib/nutrition";

const sexOptions = SEXES.map((value) => ({ value, label: ru.profile.sexes[value] }));
const activityOptions = ACTIVITY_LEVELS.map((value) => ({
  value,
  label: ru.profile.activityLevels[value].label,
  hint: ru.profile.activityLevels[value].hint,
}));
const goalOptions = GOALS.map((value) => ({ value, label: ru.profile.goals[value] }));

export function ProfileForm({
  defaults,
  submitLabel,
}: {
  defaults?: ProfileData;
  submitLabel: string;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction<FormState>(saveProfileAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <ChoiceGroup legend={ru.profile.sex} name="sex" options={sexOptions} layout="row" defaultValue={defaults?.sex} error={errors.sex} />
      <TextField label={ru.profile.birthDate} name="birthDate" type="date" defaultValue={defaults?.birthDate} error={errors.birthDate} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={ru.profile.heightCm} name="heightCm" inputMode="decimal" defaultValue={defaults?.heightCm} error={errors.heightCm} />
        <TextField label={ru.profile.weightKg} name="weightKg" inputMode="decimal" defaultValue={defaults?.weightKg} error={errors.weightKg} />
      </div>
      <ChoiceGroup legend={ru.profile.activityLevel} name="activityLevel" options={activityOptions} defaultValue={defaults?.activityLevel} error={errors.activityLevel} />
      <ChoiceGroup legend={ru.profile.goal} name="goal" options={goalOptions} layout="row" defaultValue={defaults?.goal} error={errors.goal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
```

`components/targets/targets-form.tsx`:

```tsx
"use client";

import { resetTargetAction, saveManualTargetAction } from "@/app/(app)/actions";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { formatGrams, formatKcal } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { MacroTargets } from "@/lib/nutrition";

export function TargetsForm({ current, calculated }: { current: MacroTargets; calculated: MacroTargets }) {
  const { state, pending, onSubmit } = usePreservingFormAction<FormState>(saveManualTargetAction, {});
  const errors = state.fieldErrors ?? {};
  const hint = (value: string, unit: string) => `${ru.targets.calculatedHint}: ${value} ${unit}`;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label={ru.targets.kcal} name="kcal" inputMode="decimal" defaultValue={formatKcal(current.kcal)} error={errors.kcal} />
        <p className="-mt-3 text-sm text-foreground/60">{hint(formatKcal(calculated.kcal), ru.targets.kcalUnit)}</p>
        <TextField label={ru.targets.proteinG} name="proteinG" inputMode="decimal" defaultValue={formatGrams(current.proteinG)} error={errors.proteinG} />
        <p className="-mt-3 text-sm text-foreground/60">{hint(formatGrams(calculated.proteinG), ru.targets.gramsUnit)}</p>
        <TextField label={ru.targets.fatG} name="fatG" inputMode="decimal" defaultValue={formatGrams(current.fatG)} error={errors.fatG} />
        <p className="-mt-3 text-sm text-foreground/60">{hint(formatGrams(calculated.fatG), ru.targets.gramsUnit)}</p>
        <TextField label={ru.targets.carbsG} name="carbsG" inputMode="decimal" defaultValue={formatGrams(current.carbsG)} error={errors.carbsG} />
        <p className="-mt-3 text-sm text-foreground/60">{hint(formatGrams(calculated.carbsG), ru.targets.gramsUnit)}</p>
        <FormError message={state.formError} />
        <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
      </form>
      <form action={resetTargetAction}>
        <button type="submit" className="min-h-11 w-full rounded-lg border border-foreground/20 px-4">
          {ru.targets.resetToAuto}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Страницы** — удалить `app/page.tsx`. `app/(app)/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUserId } from "@/lib/auth/session";
import { formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { getDefaultTarget } from "@/lib/targets/repo";

export default async function HomePage() {
  const userId = await requireUserId();
  const target = await getDefaultTarget(db, userId);
  if (!target) redirect("/onboarding");

  const macros = [
    { label: ru.targets.protein, grams: target.proteinG },
    { label: ru.targets.fat, grams: target.fatG },
    { label: ru.targets.carbs, grams: target.carbsG },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.app.name}</h1>
      <section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{ru.targets.cardTitle}</h2>
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs">{ru.targets.modes[target.mode]}</span>
        </div>
        <p className="text-4xl font-semibold">
          {formatKcal(target.kcal)} <span className="text-base font-normal">{ru.targets.kcalUnit}</span>
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {macros.map((macro) => (
            <div key={macro.label} className="rounded-lg bg-foreground/5 py-2">
              <dt className="text-xs text-foreground/60">{macro.label}</dt>
              <dd className="font-medium">
                {formatGrams(macro.grams)} {ru.targets.gramsUnit}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <nav className="flex flex-col gap-2">
        <Link href="/targets" className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4">
          {ru.targets.editTargets}
        </Link>
        <Link href="/profile" className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4">
          {ru.targets.editProfile}
        </Link>
      </nav>
      <SignOutButton />
    </main>
  );
}
```

`app/(app)/onboarding/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { getProfile } from "@/lib/profile/repo";

export default async function OnboardingPage() {
  const userId = await requireUserId();
  if (await getProfile(db, userId)) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.profile.onboardingTitle}</h1>
      <p className="text-foreground/70">{ru.profile.onboardingHint}</p>
      <ProfileForm submitLabel={ru.profile.submitOnboarding} />
    </main>
  );
}
```

`app/(app)/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { getProfile } from "@/lib/profile/repo";

export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(db, userId);
  if (!profile) redirect("/onboarding");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.profile.editTitle}</h1>
      <ProfileForm defaults={profile} submitLabel={ru.common.save} />
    </main>
  );
}
```

`app/(app)/targets/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { TargetsForm } from "@/components/targets/targets-form";
import { requireUserId } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/date";
import { ru } from "@/lib/i18n/ru";
import { calcAutoTargets } from "@/lib/nutrition";
import { getProfile } from "@/lib/profile/repo";
import { getDefaultTarget } from "@/lib/targets/repo";

export default async function TargetsPage() {
  const userId = await requireUserId();
  const [profile, target] = await Promise.all([getProfile(db, userId), getDefaultTarget(db, userId)]);
  if (!profile || !target) redirect("/onboarding");
  const calculated = calcAutoTargets(profile, todayIsoDate(new Date()));
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{ru.targets.editTitle}</h1>
      <TargetsForm current={target} calculated={calculated} />
    </main>
  );
}
```

`app/(app)/loading.tsx` (это и есть Suspense-граница, под которой страницы читают сессию):

```tsx
import { ru } from "@/lib/i18n/ru";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-8">
      <p className="text-foreground/60">{ru.common.loading}</p>
    </main>
  );
}
```

`app/(app)/error.tsx` — перед написанием сверить пропсы с `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` (Next 16 мог переименовать `reset`):

```tsx
"use client";

import { ru } from "@/lib/i18n/ru";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <p>{ru.common.errorTitle}</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-lg border border-foreground/20 px-4">
        {ru.common.retry}
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Проверка** — `pnpm lint && pnpm test && pnpm build` → PASS (build ловит ошибки cacheComponents вида «blocking-route»). Ручной сценарий в `pnpm dev`:
  1. `/` без сессии → `/login`.
  2. Регистрация → `/onboarding`; отправить форму с «80,5» в весе и пустым ростом → ошибка у роста, остальные значения на месте (Review Focus 1–2).
  3. Дата `2027-01-01` → ошибка у даты (Review Focus 4).
  4. Корректная форма → главная, норма с меткой «авто».
  5. «Изменить норму» → 2000 ккал → главная показывает 2000 и «вручную»; «Изменить профиль» → другой вес → норма та же.
  6. «Вернуть расчётную» → «авто», расчётные числа.
  7. «Выйти» → `/login`; повторная регистрация того же email → «недоступна» (Review Focus 5).

- [ ] **Step 5: Commit**

```bash
git add app components
git commit -m "feat: add onboarding, home target card, profile and target editing"
```

---

### Task 10: Ревью, статус и решения

**Files:**
- Modify: `docs/ru/PROJECT_PLAN.md`, `docs/ru/notes.md`, `docs/ru/superpowers/specs/2026-10-09-auth-profile-design.md` (статус → «реализовано»)

- [ ] **Step 1:** `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- [ ] **Step 2:** Субагенты `reviewer` и `security-reviewer` на `git diff master...HEAD`; `ui-checker` — сценарий из Task 9 Step 4 на 375 px. Исправить замечания отдельными коммитами `fix: …`.
- [ ] **Step 3:** `docs/ru/PROJECT_PLAN.md` «Текущий статус»: этап 1 готов, следующий — этап 2 (`ft/foods`).
- [ ] **Step 4:** `docs/ru/notes.md`: закрыть вопросы «better-auth или Auth.js» (→ Auth.js v4, Credentials + JWT) и «один пользователь или мульти» (→ мульти, регистрация по allowlist); записать решения: scrypt, in-memory rate limit, `targets.mode`, проверка сессии в страницах вместо layout из-за `cacheComponents`, `X-Forwarded-For` должен перезаписываться nginx на этапе 6; журнал.
- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: update stage 1 status and notes"
```
