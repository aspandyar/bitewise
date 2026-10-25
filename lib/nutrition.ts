import {
  ACTIVITY_FACTORS,
  FOOD_LIMITS,
  GOAL_ADJUSTMENTS,
  KCAL_CHECK,
  KCAL_PER_GRAM,
  MACRO_TARGETS,
  MIFFLIN_ST_JEOR,
  NUTRIENT_BASE_GRAMS,
  NUTRIENT_STORAGE_SCALE,
  OFF,
  PORTION_LIMITS,
  STATS,
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

export type Per100g = { kcal100: number; protein100: number; fat100: number; carbs100: number };

export type Nutrients = { kcal: number; proteinG: number; fatG: number; carbsG: number };

export function calcEntryNutrients(per100g: Per100g, grams: number): Nutrients {
  assertNonNegative("grams", grams);
  const scale = (valuePer100g: number) => (valuePer100g * grams) / NUTRIENT_BASE_GRAMS;
  return {
    kcal: scale(per100g.kcal100),
    proteinG: scale(per100g.protein100),
    fatG: scale(per100g.fat100),
    carbsG: scale(per100g.carbs100),
  };
}

export function calcPortionGrams(portionGrams: number, count: number): number {
  assertPositive("portionGrams", portionGrams);
  assertPositive("count", count);
  return portionGrams * count;
}

// The way back from grams (an entry saved by weight, then switched to portions, #81), to the
// hundredths a count is stored with. Not clamped to the portion range: a count outside it gets
// the form's own error instead of silently saving a different weight.
export function calcPortionCount(grams: number, portionGrams: number): number {
  assertPositive("grams", grams);
  assertPositive("portionGrams", portionGrams);
  return Math.round((grams / portionGrams) * NUTRIENT_STORAGE_SCALE) / NUTRIENT_STORAGE_SCALE;
}

const ZERO_NUTRIENTS: Nutrients = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      proteinG: total.proteinG + item.proteinG,
      fatG: total.fatG + item.fatG,
      carbsG: total.carbsG + item.carbsG,
    }),
    ZERO_NUTRIENTS,
  );
}

export type NutrientProgress = { eaten: number; target: number; remaining: number; share: number };

export type DayProgress = Record<keyof Nutrients, NutrientProgress>;

function calcNutrientProgress(target: number, eaten: number): NutrientProgress {
  assertNonNegative("target", target);
  assertNonNegative("eaten", eaten);
  // A manual target may set a macro to 0 g; anything eaten then is fully "over", never NaN.
  const share = target > 0 ? eaten / target : eaten > 0 ? Infinity : 0;
  return { eaten, target, remaining: target - eaten, share };
}

export function calcDayProgress(target: Nutrients, eaten: Nutrients): DayProgress {
  return {
    kcal: calcNutrientProgress(target.kcal, eaten.kcal),
    proteinG: calcNutrientProgress(target.proteinG, eaten.proteinG),
    fatG: calcNutrientProgress(target.fatG, eaten.fatG),
    carbsG: calcNutrientProgress(target.carbsG, eaten.carbsG),
  };
}

export type DayEntryValues = Per100g & { date: IsoDate; grams: number };

export type DayTotals = { date: IsoDate; nutrients: Nutrients };

// Days come out in date order and only where something was logged: an empty day is "not
// tracked", not "ate nothing", and must not pull averages down.
export function calcDayTotals(entries: readonly DayEntryValues[]): DayTotals[] {
  const byDate = new Map<IsoDate, Nutrients[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(calcEntryNutrients(entry, entry.grams));
    byDate.set(entry.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, list]) => ({ date, nutrients: sumNutrients(list) }));
}

export function isDayInTarget(kcal: number, targetKcal: number): boolean {
  assertNonNegative("kcal", kcal);
  assertNonNegative("targetKcal", targetKcal);
  // A zero target (manual) has no band around it; no day is "on target" against it.
  if (targetKcal === 0) return false;
  return Math.abs(kcal - targetKcal) <= targetKcal * STATS.inTargetShare;
}

export type PeriodSummary = { average: Nutrients; daysLogged: number; daysInTarget: number };

export function calcPeriodSummary(days: readonly DayTotals[], target: Nutrients): PeriodSummary {
  const daysLogged = days.length;
  if (daysLogged === 0) return { average: ZERO_NUTRIENTS, daysLogged, daysInTarget: 0 };
  const total = sumNutrients(days.map((day) => day.nutrients));
  return {
    average: {
      kcal: total.kcal / daysLogged,
      proteinG: total.proteinG / daysLogged,
      fatG: total.fatG / daysLogged,
      carbsG: total.carbsG / daysLogged,
    },
    daysLogged,
    daysInTarget: days.filter((day) => isDayInTarget(day.nutrients.kcal, target.kcal)).length,
  };
}

export type RecipeItemValues = { per100g: Per100g; grams: number };

export type RecipeTotals = {
  rawWeightG: number;
  // What the totals are divided by: the cooked (or raw) weight, never below what is plausible.
  weightG: number;
  totals: Nutrients;
  per100g: Per100g;
  weightRaised: boolean;
};

const ZERO_PER_100G: Per100g = { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0 };

// A dish cannot weigh less than its protein, fat and carbs, nor hold more kcal per 100 g than any
// food may. Rounded to stored precision so float noise (33.3 + 33.3 + 33.4) never flags an honest
// raw weight.
function minPlausibleWeightG(totals: Nutrients): number {
  const byNutrients =
    ((totals.proteinG + totals.fatG + totals.carbsG) * NUTRIENT_BASE_GRAMS) /
    FOOD_LIMITS.maxTotalGramsPer100G;
  const byKcal = (totals.kcal * NUTRIENT_BASE_GRAMS) / FOOD_LIMITS.kcal100.max;
  return (
    Math.round(Math.max(byNutrients, byKcal) * NUTRIENT_STORAGE_SCALE) / NUTRIENT_STORAGE_SCALE
  );
}

// Water boils off, so a dish is divided by its cooked weight; without one, by the raw weight.
export function calcRecipe(
  items: readonly RecipeItemValues[],
  cookedWeightG: number | null,
): RecipeTotals {
  if (cookedWeightG !== null) assertPositive("cookedWeightG", cookedWeightG);
  const totals = sumNutrients(items.map((item) => calcEntryNutrients(item.per100g, item.grams)));
  const rawWeightG = items.reduce((sum, item) => sum + item.grams, 0);
  const statedWeightG = cookedWeightG ?? rawWeightG;
  // A typo ("10 g" for a pot) or a later edit of an ingredient must not yield 4000 kcal per 100 g
  // or overflow numeric(8,2); forms reject such weights, this keeps stored numbers possible.
  const weightG = Math.max(statedWeightG, minPlausibleWeightG(totals));
  const per100 = (value: number) => (value * NUTRIENT_BASE_GRAMS) / weightG;
  return {
    rawWeightG,
    weightG,
    totals,
    per100g:
      weightG > 0
        ? {
            kcal100: per100(totals.kcal),
            protein100: per100(totals.proteinG),
            fat100: per100(totals.fatG),
            carbs100: per100(totals.carbsG),
          }
        : ZERO_PER_100G,
    weightRaised: weightG > statedWeightG,
  };
}

export function calcServingGrams(weightG: number, servings: number): number {
  assertNonNegative("weightG", weightG);
  assertPositive("servings", servings);
  return weightG / servings;
}

// The serving becomes a food portion, so it must fit one: below the minimum it would round to 0 g
// in numeric(8,2), above the maximum 50 servings in the diary would overflow it.
export function calcServingPortionGrams(weightG: number, servings: number | null): number | null {
  if (servings === null) return null;
  const grams = calcServingGrams(weightG, servings);
  return grams >= PORTION_LIMITS.grams.min && grams <= PORTION_LIMITS.grams.max ? grams : null;
}

export type MacroGrams = { proteinG: number; fatG: number; carbsG: number; fiberG: number | null };

// Atwater estimate of energy per the given grams; carbs are net, so known fiber adds its own share.
export function calcKcalFromMacros(macros: MacroGrams): number {
  return (
    macros.proteinG * KCAL_PER_GRAM.protein +
    macros.fatG * KCAL_PER_GRAM.fat +
    macros.carbsG * KCAL_PER_GRAM.carbs +
    (macros.fiberG ?? 0) * KCAL_PER_GRAM.fiber
  );
}

// A soft check for typos in a food's own numbers: labels round and alcohol is not counted, so
// a miss is only flagged when it is large both in share and in kcal.
export function isKcalConsistentWithMacros(kcal: number, macros: MacroGrams): boolean {
  const off = Math.abs(kcal - calcKcalFromMacros(macros));
  return off <= Math.max(kcal * KCAL_CHECK.maxShareOff, KCAL_CHECK.minKcalOff);
}

// A label's energy given only in kilojoules: a unit conversion, not an estimate.
export function calcKcalFromKj(kj: number): number {
  return kj / OFF.kjPerKcal;
}

// A label's per-serving figure on our per-100 g basis; the caller vouches for the serving weight.
export function calcPer100gFromServing(valuePerServing: number, servingGrams: number): number {
  return (valuePerServing * NUTRIENT_BASE_GRAMS) / servingGrams;
}
