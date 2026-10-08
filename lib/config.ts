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

// TDEE = BMR × factor.
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

// Daily target kcal = TDEE × (1 + adjustment).
export const GOAL_ADJUSTMENTS = {
  lose: -0.15,
  maintain: 0,
  gain: 0.1,
} as const;
export type Goal = keyof typeof GOAL_ADJUSTMENTS;
