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

// Ordered by privilege. "admin" is only ever granted by the bootstrap script, never by the app.
export const USER_ROLES = ["user", "manager", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

// ~100 bytes per key, so the cap costs ~10 MB; reaching it takes a botnet, not one script.
export const RATE_LIMITS = {
  login: { max: 10, windowMs: 15 * MS_PER_MINUTE, maxKeys: 100_000 },
  register: { max: 5, windowMs: 60 * MS_PER_MINUTE, maxKeys: 100_000 },
  // Search fires on every typed letter after a debounce; 2 per second is far above human typing.
  foodSearch: { max: 120, windowMs: MS_PER_MINUTE, maxKeys: 100_000 },
} as const;

// Number of reverse proxies we control in front of the app (nginx, stage 6). Each one appends the
// peer it saw to X-Forwarded-For, so the client IP sits that many entries from the right.
export const TRUSTED_PROXY_HOPS = 1;

// Where a food's numbers come from; shown as a badge in search. "off" and "ai_estimate" arrive
// with their own stages through a migration.
export const FOOD_SOURCES = ["user", "usda", "label"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

// Per 100 g: pure fat is ~900 kcal, and no 100 g of food holds more than 100 g of nutrients.
export const FOOD_LIMITS = {
  nameLength: { min: 1, max: 100 },
  kcal100: { min: 0, max: 900 },
  nutrient100G: { min: 0, max: 100 },
  maxTotalGramsPer100G: 100,
} as const;

export const PORTION_LIMITS = {
  labelLength: { min: 1, max: 40 },
  grams: { min: 0.1, max: 5000 },
  // Keeps a portion list scannable on a phone screen.
  maxOwnPerFood: 20,
} as const;

export const FOOD_SEARCH = {
  limit: 20,
  maxQueryLength: 50,
  // Trigrams carry no signal below 3 letters; shorter queries match word starts only.
  minTrigramLength: 3,
  // pg_trgm word_similarity cut-off, tuned on real typos: "грчка" → "гречка" scores 0.44 and
  // "гречко" 0.71, while the unrelated "гречко" → "молоко" scores 0.14.
  wordSimilarityThreshold: 0.4,
  debounceMs: 250,
} as const;

// FoodData Central nutrient ids (nutrient.csv), all per 100 g.
export const USDA_NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbsByDifference: 1005,
  fiber: 1079,
} as const;

// Matches numeric(8,2): seed values are rounded to what the column stores, so diffs stay stable.
export const NUTRIENT_STORAGE_DECIMALS = 2;
