import { describe, expect, it } from "vitest";
import {
  calcAgeYears,
  calcKcalFromKj,
  calcPer100gFromServing,
  calcKcalFromMacros,
  isKcalConsistentWithMacros,
  calcDayProgress,
  calcDayTotals,
  calcPeriodSummary,
  isDayInTarget,
  calcEntryNutrients,
  calcPortionCount,
  calcPortionGrams,
  calcRecipe,
  calcServingGrams,
  calcServingPortionGrams,
  sumNutrients,
  calcAutoTargets,
  calcBmrKcal,
  calcMacroTargets,
  calcNetCarbsPer100g,
  calcTargetKcal,
  calcTdeeKcal,
} from "./nutrition";

describe("calcBmrKcal (Mifflin-St Jeor)", () => {
  it("returns 1780 kcal for a 30-year-old male, 80 kg, 180 cm", () => {
    // 10 × 80 + 6.25 × 180 − 5 × 30 + 5 = 800 + 1125 − 150 + 5
    expect(calcBmrKcal({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
  });

  it("returns 1345.25 kcal for a 25-year-old female, 60 kg, 165 cm without rounding", () => {
    // 10 × 60 + 6.25 × 165 − 5 × 25 − 161 = 600 + 1031.25 − 125 − 161
    expect(calcBmrKcal({ sex: "female", weightKg: 60, heightCm: 165, ageYears: 25 })).toBe(1345.25);
  });

  it("differs by exactly 166 kcal between sexes with identical body parameters", () => {
    const body = { weightKg: 70, heightCm: 172, ageYears: 40 };
    const male = calcBmrKcal({ sex: "male", ...body });
    const female = calcBmrKcal({ sex: "female", ...body });
    expect(male - female).toBe(166);
  });

  it("accepts age 0 because the formula is defined there", () => {
    // 10 × 3.5 + 6.25 × 50 − 5 × 0 + 5 = 35 + 312.5 + 5
    expect(calcBmrKcal({ sex: "male", weightKg: 3.5, heightCm: 50, ageYears: 0 })).toBe(352.5);
  });

  it.each([
    { field: "weightKg", body: { weightKg: 0, heightCm: 170, ageYears: 30 } },
    { field: "heightCm", body: { weightKg: 70, heightCm: 0, ageYears: 30 } },
    { field: "ageYears", body: { weightKg: 70, heightCm: 170, ageYears: -1 } },
    { field: "weightKg", body: { weightKg: Number.NaN, heightCm: 170, ageYears: 30 } },
  ])("throws RangeError for invalid $field", ({ body }) => {
    expect(() => calcBmrKcal({ sex: "female", ...body })).toThrow(RangeError);
  });
});

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

describe("calculation guards", () => {
  it.each([0, -100, Number.NaN])("calcTdeeKcal throws RangeError for BMR %s", (bmr) => {
    expect(() => calcTdeeKcal(bmr, "moderate")).toThrow(RangeError);
  });

  it.each([0, -100, Number.NaN])("calcTargetKcal throws RangeError for TDEE %s", (tdee) => {
    expect(() => calcTargetKcal(tdee, "maintain")).toThrow(RangeError);
  });

  it.each([
    [0, 80],
    [2000, 0],
    [-1, 80],
    [2000, Number.NaN],
  ])("calcMacroTargets throws RangeError for kcal %s, weight %s", (kcal, weightKg) => {
    expect(() => calcMacroTargets(kcal, weightKg)).toThrow(RangeError);
  });
});

describe("calcAutoTargets limits", () => {
  it("raises an implausibly low target to the manual minimum of 800 kcal", () => {
    // BMR 10 × 30 + 6.25 × 100 − 5 × 100 − 161 = 264; × 1.2 × 0.85 = 269.28 → 800
    const targets = calcAutoTargets(
      {
        sex: "female",
        birthDate: "1926-01-01",
        heightCm: 100,
        weightKg: 30,
        activityLevel: "sedentary",
        goal: "lose",
      },
      "2026-10-09",
    );
    expect(targets.kcal).toBe(800);
    expect(targets.proteinG).toBeCloseTo(54, 6); // 30 × 1.8
    expect(targets.fatG).toBeCloseTo(24, 6); // 800 × 0.27 / 9
    expect(targets.carbsG).toBeCloseTo(92, 6); // (800 − 216 − 216) / 4
  });

  it("caps an extreme target at the manual maximum of 6000 kcal", () => {
    // BMR 10 × 300 + 6.25 × 250 − 5 × 14 + 5 = 4497.5; × 1.9 × 1.1 = 9399.775 → 6000
    const targets = calcAutoTargets(
      {
        sex: "male",
        birthDate: "2012-01-01",
        heightCm: 250,
        weightKg: 300,
        activityLevel: "veryActive",
        goal: "gain",
      },
      "2026-10-09",
    );
    expect(targets.kcal).toBe(6000);
    expect(targets.proteinG).toBeCloseTo(540, 6); // 300 × 1.8
    expect(targets.fatG).toBeCloseTo(180, 6); // 6000 × 0.27 / 9
    expect(targets.carbsG).toBeCloseTo(555, 6); // (6000 − 2160 − 1620) / 4
  });
});

describe("calcNetCarbsPer100g", () => {
  it("subtracts fiber from carbs by difference", () => {
    // Buckwheat groats, USDA SR Legacy: 71.5 g carbs by difference, 10 g fiber.
    expect(calcNetCarbsPer100g(71.5, 10)).toBeCloseTo(61.5, 10);
  });

  it("keeps carbs as they are when fiber is unknown", () => {
    expect(calcNetCarbsPer100g(12.3, null)).toBe(12.3);
  });

  it("returns 0 for 0 g carbs", () => {
    expect(calcNetCarbsPer100g(0, 0)).toBe(0);
  });

  it("clamps to 0 when fiber exceeds carbs by difference", () => {
    // Happens in lab data for some greens: carbs by difference 2.9 g, fiber 3.1 g.
    expect(calcNetCarbsPer100g(2.9, 3.1)).toBe(0);
  });

  it("rejects negative and NaN inputs", () => {
    expect(() => calcNetCarbsPer100g(-1, 0)).toThrow(RangeError);
    expect(() => calcNetCarbsPer100g(10, -1)).toThrow(RangeError);
    expect(() => calcNetCarbsPer100g(Number.NaN, 0)).toThrow(RangeError);
    expect(() => calcNetCarbsPer100g(10, Number.NaN)).toThrow(RangeError);
  });
});

describe("calcEntryNutrients", () => {
  const buckwheat = { kcal100: 343, protein100: 13.3, fat100: 3.4, carbs100: 62.1 };

  it("scales per-100 g values to 150 g", () => {
    // 343 × 150 / 100 = 514.5; 13.3 × 1.5 = 19.95; 3.4 × 1.5 = 5.1; 62.1 × 1.5 = 93.15
    const result = calcEntryNutrients(buckwheat, 150);
    expect(result.kcal).toBe(514.5);
    expect(result.proteinG).toBeCloseTo(19.95, 10);
    expect(result.fatG).toBeCloseTo(5.1, 10);
    expect(result.carbsG).toBeCloseTo(93.15, 10);
  });

  it("returns zeros for 0 g", () => {
    expect(calcEntryNutrients(buckwheat, 0)).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
  });

  it.each([-1, Number.NaN])("throws RangeError for %d g", (grams) => {
    expect(() => calcEntryNutrients(buckwheat, grams)).toThrow(RangeError);
  });
});

describe("calcPortionGrams", () => {
  it("multiplies portion grams by the count", () => {
    // 60 g × 1.5 = 90 g
    expect(calcPortionGrams(60, 1.5)).toBe(90);
  });

  it.each([
    { portionGrams: 0, count: 1 },
    { portionGrams: 60, count: 0 },
    { portionGrams: 60, count: -1 },
    { portionGrams: Number.NaN, count: 1 },
  ])("throws RangeError for $portionGrams g × $count", ({ portionGrams, count }) => {
    expect(() => calcPortionGrams(portionGrams, count)).toThrow(RangeError);
  });
});

describe("calcPortionCount", () => {
  it("turns grams into portions", () => {
    // 60 g ÷ 50 g = 1.2 pcs
    expect(calcPortionCount(60, 50)).toBe(1.2);
  });

  it("rounds to the hundredths the database stores", () => {
    // 100 g ÷ 30 g = 3.333… → 3.33
    expect(calcPortionCount(100, 30)).toBe(3.33);
  });

  it("does not clamp: a count outside the portion range is the form's error, not a new weight", () => {
    // 1 g ÷ 50 g = 0.02; 5000 g ÷ 10 g = 500. Clamping to 0.25 or 50 would silently save 12.5 g
    // or 500 g instead.
    expect(calcPortionCount(1, 50)).toBe(0.02);
    expect(calcPortionCount(5000, 10)).toBe(500);
  });

  it.each([
    { grams: 0, portionGrams: 50 },
    { grams: 60, portionGrams: 0 },
    { grams: Number.NaN, portionGrams: 50 },
  ])("throws RangeError for $grams g ÷ $portionGrams g", ({ grams, portionGrams }) => {
    expect(() => calcPortionCount(grams, portionGrams)).toThrow(RangeError);
  });
});

describe("sumNutrients", () => {
  it("returns zeros for an empty list", () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
  });

  it("adds up three entries", () => {
    // kcal 514.5 + 157 + 52 = 723.5; protein 20 + 12.7 + 0.3 = 33; fat 5 + 10.9 + 0.2 = 16.1;
    // carbs 93 + 0.7 + 13.8 = 107.5
    const total = sumNutrients([
      { kcal: 514.5, proteinG: 20, fatG: 5, carbsG: 93 },
      { kcal: 157, proteinG: 12.7, fatG: 10.9, carbsG: 0.7 },
      { kcal: 52, proteinG: 0.3, fatG: 0.2, carbsG: 13.8 },
    ]);
    expect(total.kcal).toBe(723.5);
    expect(total.proteinG).toBeCloseTo(33, 10);
    expect(total.fatG).toBeCloseTo(16.1, 10);
    expect(total.carbsG).toBeCloseTo(107.5, 10);
  });
});

describe("calcDayProgress", () => {
  const target = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 200 };

  it("reports remaining and share per nutrient, including overshoot", () => {
    const progress = calcDayProgress(target, { kcal: 1500, proteinG: 160, fatG: 60, carbsG: 0 });
    expect(progress.kcal).toEqual({ eaten: 1500, target: 2000, remaining: 500, share: 0.75 });
    // 150 − 160 = −10 (over); 160 / 150 is not clamped
    expect(progress.proteinG).toEqual({
      eaten: 160,
      target: 150,
      remaining: -10,
      share: 160 / 150,
    });
    expect(progress.fatG).toEqual({ eaten: 60, target: 60, remaining: 0, share: 1 });
    expect(progress.carbsG).toEqual({ eaten: 0, target: 200, remaining: 200, share: 0 });
  });

  it("handles a zero target without NaN", () => {
    const zeroCarbs = { ...target, carbsG: 0 };
    const none = calcDayProgress(zeroCarbs, { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
    expect(none.carbsG).toEqual({ eaten: 0, target: 0, remaining: 0, share: 0 });
    const some = calcDayProgress(zeroCarbs, { kcal: 40, proteinG: 0, fatG: 0, carbsG: 10 });
    expect(some.carbsG).toEqual({ eaten: 10, target: 0, remaining: -10, share: Infinity });
  });

  it("throws RangeError for a negative value", () => {
    expect(() => calcDayProgress(target, { kcal: -1, proteinG: 0, fatG: 0, carbsG: 0 })).toThrow(
      RangeError,
    );
  });
});

// Hand-computed: buckwheat 200 g → 686 kcal, P 26, F 6.8, C 124; oil 10 g → 89.9 kcal, F 9.99.
// Totals: 775.9 kcal, P 26, F 16.79, C 124; raw weight 210 g.
const buckwheat = { kcal100: 343, protein100: 13, fat100: 3.4, carbs100: 62 };
const oil = { kcal100: 899, protein100: 0, fat100: 99.9, carbs100: 0 };
const water = { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0 };
const pot = [
  { per100g: buckwheat, grams: 200 },
  { per100g: oil, grams: 10 },
];

describe("calcRecipe", () => {
  it("divides the totals by the cooked weight", () => {
    const result = calcRecipe(pot, 500);
    expect(result.rawWeightG).toBe(210);
    expect(result.weightG).toBe(500);
    expect(result.weightRaised).toBe(false);
    expect(result.totals.kcal).toBeCloseTo(775.9, 6);
    expect(result.per100g.kcal100).toBeCloseTo(155.18, 6);
    expect(result.per100g.protein100).toBeCloseTo(5.2, 6);
    expect(result.per100g.fat100).toBeCloseTo(3.358, 6);
    expect(result.per100g.carbs100).toBeCloseTo(24.8, 6);
  });

  it("uses the raw weight when the dish was not weighed", () => {
    const result = calcRecipe(pot, null);
    expect(result.weightG).toBe(210);
    expect(result.weightRaised).toBe(false);
    expect(result.per100g.kcal100).toBeCloseTo(369.476, 3);
    expect(result.per100g.protein100).toBeCloseTo(12.381, 3);
    expect(result.per100g.carbs100).toBeCloseTo(59.048, 3);
  });

  it("returns zeros for an empty recipe with or without a cooked weight", () => {
    const zero = { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0 };
    expect(calcRecipe([], null)).toEqual({
      rawWeightG: 0,
      weightG: 0,
      totals: { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
      per100g: zero,
      weightRaised: false,
    });
    expect(calcRecipe([], 300).per100g).toEqual(zero);
    expect(calcRecipe([], 300).weightG).toBe(300);
  });

  it("lets a 0 kcal ingredient only add weight", () => {
    const result = calcRecipe(
      [
        { per100g: water, grams: 200 },
        { per100g: buckwheat, grams: 200 },
      ],
      null,
    );
    expect(result.weightG).toBe(400);
    expect(result.per100g.kcal100).toBeCloseTo(171.5, 6);
  });

  it("raises a cooked weight below the grams of protein, fat and carbs", () => {
    const result = calcRecipe(pot, 100);
    expect(result.weightRaised).toBe(true);
    expect(result.weightG).toBeCloseTo(166.79, 6);
    const { protein100, fat100, carbs100 } = result.per100g;
    expect(protein100 + fat100 + carbs100).toBeCloseTo(100, 6);
  });

  it("raises a cooked weight that would put more kcal in 100 g than any food has", () => {
    // 900 kcal, no macros: 100 g of it cannot weigh less than 100 g once cooked.
    const result = calcRecipe([{ per100g: { ...water, kcal100: 900 }, grams: 100 }], 1);
    expect(result.weightRaised).toBe(true);
    expect(result.weightG).toBe(100);
    expect(result.per100g.kcal100).toBeCloseTo(900, 6);
  });

  it("raises oil boiled down to half to its nutrient weight", () => {
    // Fat 9.99 g vs kcal floor 89.9 × 100 / 900 = 9.989 g → 9.99 g.
    const result = calcRecipe([{ per100g: oil, grams: 10 }], 5);
    expect(result.weightG).toBeCloseTo(9.99, 6);
    expect(result.per100g.fat100).toBeCloseTo(100, 6);
    expect(result.per100g.kcal100).toBeCloseTo(899.9, 1);
  });

  it("does not flag an honest raw weight because of float noise", () => {
    // 33.3 + 33.3 + 33.4 is 100.00000000000001 in floats.
    const dense = { kcal100: 0, protein100: 33.3, fat100: 33.3, carbs100: 33.4 };
    const result = calcRecipe([{ per100g: dense, grams: 100 }], null);
    expect(result.weightRaised).toBe(false);
    expect(result.weightG).toBe(100);
  });

  it.each([0, -1, Number.NaN])("throws on a cooked weight of %s", (weight) => {
    expect(() => calcRecipe(pot, weight)).toThrow(RangeError);
  });
});

describe("calcServingGrams", () => {
  it("splits the weight into servings", () => {
    expect(calcServingGrams(500, 4)).toBe(125);
  });

  it("returns 0 g for an empty dish", () => {
    expect(calcServingGrams(0, 4)).toBe(0);
  });

  it.each([0, -1, Number.NaN])("throws on %s servings", (servings) => {
    expect(() => calcServingGrams(500, servings)).toThrow(RangeError);
  });
});

describe("calcServingPortionGrams", () => {
  it("returns the serving when it fits a portion", () => {
    expect(calcServingPortionGrams(500, 4)).toBe(125);
  });

  it("returns null without servings", () => {
    expect(calcServingPortionGrams(500, null)).toBeNull();
  });

  it("returns null for a serving too small to store", () => {
    // 0.1 g / 100 = 0.001 g would be stored as 0 in numeric(8,2).
    expect(calcServingPortionGrams(0.1, 100)).toBeNull();
  });

  it("returns null for a serving heavier than any portion", () => {
    // 20 kg in one serving × 50 in the diary would overflow numeric(8,2).
    expect(calcServingPortionGrams(20_000, 1)).toBeNull();
  });
});

describe("calcKcalFromMacros", () => {
  it("counts 4 kcal per g of protein and carbs and 9 per g of fat", () => {
    // 12.6 × 4 + 3.3 × 9 + 57.1 × 4 = 50.4 + 29.7 + 228.4 = 308.5
    expect(
      calcKcalFromMacros({ proteinG: 12.6, fatG: 3.3, carbsG: 57.1, fiberG: null }),
    ).toBeCloseTo(308.5, 10);
  });

  it("adds 2 kcal per g of fiber when it is known", () => {
    // 1 × 4 + 0.7 × 9 + 5.4 × 4 + 6.5 × 2 = 4 + 6.3 + 21.6 + 13 = 44.9
    expect(calcKcalFromMacros({ proteinG: 1, fatG: 0.7, carbsG: 5.4, fiberG: 6.5 })).toBeCloseTo(
      44.9,
      10,
    );
  });
});

describe("isKcalConsistentWithMacros", () => {
  const buckwheat = { proteinG: 12.6, fatG: 3.3, carbsG: 57.1, fiberG: null };
  const zero = { proteinG: 0, fatG: 0, carbsG: 0, fiberG: null };

  it("accepts water: nothing on the label, nothing by the formula", () => {
    expect(calcKcalFromMacros(zero)).toBe(0);
    expect(isKcalConsistentWithMacros(0, zero)).toBe(true);
  });

  it("lets the 20 % share decide for a dense food", () => {
    // 50 g of protein = 200 kcal by the formula. 250 kcal is 50 off, exactly 20 % of 250: accepted.
    // 260 kcal is 60 off, more than 20 % of 260 (52) and more than 20 kcal: flagged.
    const protein = { proteinG: 50, fatG: 0, carbsG: 0, fiberG: null };
    expect(isKcalConsistentWithMacros(250, protein)).toBe(true);
    expect(isKcalConsistentWithMacros(260, protein)).toBe(false);
  });

  it("accepts a miss of exactly 20 kcal on a light food", () => {
    // 10 g of carbs = 40 kcal; 60 kcal is 20 off — the floor, while 20 % of 60 is only 12.
    expect(isKcalConsistentWithMacros(60, { proteinG: 0, fatG: 0, carbsG: 10, fiberG: null })).toBe(
      true,
    );
  });

  it("accepts label kcal close to the formula", () => {
    expect(isKcalConsistentWithMacros(313, buckwheat)).toBe(true);
  });

  it("flags a dropped digit", () => {
    expect(isKcalConsistentWithMacros(31, buckwheat)).toBe(false);
  });

  it("ignores a large share of a tiny number", () => {
    // Black coffee: 1 kcal on the label, 0.7 by the formula — 30 % off, but 0.3 kcal.
    expect(
      isKcalConsistentWithMacros(1, { proteinG: 0.1, fatG: 0, carbsG: 0.075, fiberG: null }),
    ).toBe(true);
  });

  it("flags alcohol, which the formula does not count", () => {
    // Dry red wine: 85 kcal, 10.7 by protein, fat and carbs.
    expect(
      isKcalConsistentWithMacros(85, { proteinG: 0.1, fatG: 0, carbsG: 2.6, fiberG: null }),
    ).toBe(false);
  });
});

describe("calcKcalFromKj", () => {
  it("converts kilojoules at 4.184 kJ per kcal", () => {
    // 1937.32 / 4.184 = 463.03
    expect(calcKcalFromKj(1937.32)).toBeCloseTo(463.03, 2);
    expect(calcKcalFromKj(0)).toBe(0);
  });
});

describe("calcPer100gFromServing", () => {
  it("scales a per-serving value to 100 g by the serving weight", () => {
    // 173 kcal in a 60 g bar → 288.33 per 100 g
    expect(calcPer100gFromServing(173, 60)).toBeCloseTo(288.33, 2);
    expect(calcPer100gFromServing(0, 60)).toBe(0);
  });
});

describe("calcDayTotals", () => {
  const oats = { kcal100: 350, protein100: 12, fat100: 6, carbs100: 60 };
  const milk = { kcal100: 60, protein100: 3, fat100: 3.2, carbs100: 4.7 };

  it("returns no days for no entries", () => {
    expect(calcDayTotals([])).toEqual([]);
  });

  it("sums each day's entries and orders days by date", () => {
    // 10-15: oats 50 g = 175 kcal, P 6, F 3, C 30
    // 10-14: oats 100 g = 350 kcal + milk 200 g = 120 kcal → 470; P 12 + 6 = 18; F 6 + 6.4 = 12.4;
    // C 60 + 9.4 = 69.4
    const days = calcDayTotals([
      { date: "2026-10-15", grams: 50, ...oats },
      { date: "2026-10-14", grams: 100, ...oats },
      { date: "2026-10-14", grams: 200, ...milk },
    ]);
    expect(days.map((day) => day.date)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(days[0]!.nutrients.kcal).toBe(470);
    expect(days[0]!.nutrients.proteinG).toBe(18);
    expect(days[0]!.nutrients.fatG).toBeCloseTo(12.4, 10);
    expect(days[0]!.nutrients.carbsG).toBeCloseTo(69.4, 10);
    expect(days[1]!.nutrients).toEqual({ kcal: 175, proteinG: 6, fatG: 3, carbsG: 30 });
  });

  it("counts a day whose only entry is 0 g as logged with zero totals", () => {
    expect(calcDayTotals([{ date: "2026-10-14", grams: 0, ...oats }])).toEqual([
      { date: "2026-10-14", nutrients: { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 } },
    ]);
  });
});

describe("isDayInTarget", () => {
  it("counts a day within 10 % of the kcal target, edges included", () => {
    // 2000 ± 10 % = 1800…2200
    expect(isDayInTarget(2000, 2000)).toBe(true);
    expect(isDayInTarget(1800, 2000)).toBe(true);
    expect(isDayInTarget(2200, 2000)).toBe(true);
    expect(isDayInTarget(1799, 2000)).toBe(false);
    expect(isDayInTarget(2201, 2000)).toBe(false);
  });

  it("rejects negative kcal", () => {
    expect(() => isDayInTarget(-1, 2000)).toThrow(RangeError);
    expect(() => isDayInTarget(2000, -1)).toThrow(RangeError);
  });

  it("does not count a day against a zero target", () => {
    expect(isDayInTarget(0, 0)).toBe(false);
    expect(isDayInTarget(100, 0)).toBe(false);
  });
});

describe("calcPeriodSummary", () => {
  const target = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 200 };

  it("returns zeros for a period without entries", () => {
    expect(calcPeriodSummary([], target)).toEqual({
      average: { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
      daysLogged: 0,
      daysInTarget: 0,
    });
  });

  it("averages over logged days only and counts days in target", () => {
    // kcal (1900 + 2500 + 1600) / 3 = 2000; protein (140 + 160 + 90) / 3 = 130;
    // fat (60 + 90 + 30) / 3 = 60; carbs (200 + 250 + 160) / 3 = 203.33…
    // In target: 1900 (within 1800…2200) only.
    const summary = calcPeriodSummary(
      [
        { date: "2026-10-19", nutrients: { kcal: 1900, proteinG: 140, fatG: 60, carbsG: 200 } },
        { date: "2026-10-20", nutrients: { kcal: 2500, proteinG: 160, fatG: 90, carbsG: 250 } },
        { date: "2026-10-22", nutrients: { kcal: 1600, proteinG: 90, fatG: 30, carbsG: 160 } },
      ],
      target,
    );
    expect(summary.average.kcal).toBe(2000);
    expect(summary.average.proteinG).toBe(130);
    expect(summary.average.fatG).toBe(60);
    expect(summary.average.carbsG).toBeCloseTo(203.333, 3);
    expect(summary.daysLogged).toBe(3);
    expect(summary.daysInTarget).toBe(1);
  });
});
