import { describe, expect, it } from "vitest";
import {
  calcAgeYears,
  calcAutoTargets,
  calcBmrKcal,
  calcMacroTargets,
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
