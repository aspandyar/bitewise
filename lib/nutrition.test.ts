import { describe, expect, it } from "vitest";
import { calcBmrKcal } from "./nutrition";

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
