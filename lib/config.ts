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

// Number of reverse proxies we control in front of the app (nginx, stage 6). Each one appends the
// peer it saw to X-Forwarded-For, so the client IP sits that many entries from the right.
export const TRUSTED_PROXY_HOPS = 1;
