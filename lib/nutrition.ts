import {
  ACTIVITY_FACTORS,
  GOAL_ADJUSTMENTS,
  KCAL_PER_GRAM,
  MACRO_TARGETS,
  MIFFLIN_ST_JEOR,
  TARGET_LIMITS,
  type ActivityLevel,
  type Goal,
  type Sex,
} from "@/lib/config";
import { parseIsoDate, type IsoDate } from "@/lib/date";

export type BmrInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  // Age is passed in rather than derived from a birth date so the function stays pure.
  ageYears: number;
};

// Forms validate realistic ranges with zod; this guard only stops nonsense from
// silently producing a plausible-looking number if a caller skips validation.
function assertBmrInput({ weightKg, heightCm, ageYears }: BmrInput): void {
  if (!(Number.isFinite(weightKg) && weightKg > 0)) {
    throw new RangeError(`weightKg must be a positive number, got ${weightKg}`);
  }
  if (!(Number.isFinite(heightCm) && heightCm > 0)) {
    throw new RangeError(`heightCm must be a positive number, got ${heightCm}`);
  }
  if (!(Number.isFinite(ageYears) && ageYears >= 0)) {
    throw new RangeError(`ageYears must be a non-negative number, got ${ageYears}`);
  }
}

export function calcBmrKcal(input: BmrInput): number {
  assertBmrInput(input);
  const { sex, weightKg, heightCm, ageYears } = input;
  return (
    MIFFLIN_ST_JEOR.kcalPerKg * weightKg +
    MIFFLIN_ST_JEOR.kcalPerCm * heightCm -
    MIFFLIN_ST_JEOR.kcalPerYear * ageYears +
    MIFFLIN_ST_JEOR.sexConstantKcal[sex]
  );
}

export function calcAgeYears(birthDate: IsoDate, today: IsoDate): number {
  const birth = parseIsoDate(birthDate);
  const now = parseIsoDate(today);
  if (!birth || !now) {
    throw new RangeError(`invalid date: birthDate=${birthDate}, today=${today}`);
  }
  // Comparing (month, day) pairs makes Feb 29 birthdays count from Mar 1 in common years.
  const hadBirthday =
    now.month > birth.month || (now.month === birth.month && now.day >= birth.day);
  return now.year - birth.year - (hadBirthday ? 0 : 1);
}

function assertPositive(name: string, value: number): void {
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError(`${name} must be a positive number, got ${value}`);
  }
}

export function calcTdeeKcal(bmrKcal: number, activityLevel: ActivityLevel): number {
  assertPositive("bmrKcal", bmrKcal);
  return bmrKcal * ACTIVITY_FACTORS[activityLevel];
}

export function calcTargetKcal(tdeeKcal: number, goal: Goal): number {
  assertPositive("tdeeKcal", tdeeKcal);
  return tdeeKcal * (1 + GOAL_ADJUSTMENTS[goal]);
}

export type MacroTargets = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export function calcMacroTargets(kcal: number, weightKg: number): MacroTargets {
  assertPositive("kcal", kcal);
  assertPositive("weightKg", weightKg);
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
  const rawKcal = calcTargetKcal(calcTdeeKcal(bmrKcal, profile.activityLevel), profile.goal);
  // Extreme but valid profiles produce targets outside what the user may enter by hand; clamping
  // keeps the auto target editable and never suggests an unsafe 269 kcal or 9400 kcal day.
  const kcal = Math.min(TARGET_LIMITS.kcal.max, Math.max(TARGET_LIMITS.kcal.min, rawKcal));
  return calcMacroTargets(kcal, profile.weightKg);
}

function assertNonNegative(name: string, value: number): void {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`${name} must be a non-negative number, got ${value}`);
  }
}

// USDA reports carbs "by difference", which includes fiber; Russian labels and tables do not.
// Storing net carbs keeps seeded foods comparable with what users read on packages.
export function calcNetCarbsPer100g(carbsByDifferenceG: number, fiberG: number | null): number {
  assertNonNegative("carbsByDifferenceG", carbsByDifferenceG);
  if (fiberG === null) return carbsByDifferenceG;
  assertNonNegative("fiberG", fiberG);
  // Lab rounding can put fiber above carbs by difference; negative carbs are meaningless.
  return Math.max(0, carbsByDifferenceG - fiberG);
}
