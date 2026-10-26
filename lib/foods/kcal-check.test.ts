import { describe, expect, it } from "vitest";
import { kcalMismatchEstimate, quickKcalMismatchEstimate } from "./kcal-check";

const buckwheat = {
  kcal100: "313",
  protein100: "12,6",
  fat100: "3,3",
  carbs100: "57,1",
  fiber100: "",
};

describe("kcalMismatchEstimate", () => {
  it("stays quiet when kcal agree with the macros", () => {
    expect(kcalMismatchEstimate(buckwheat)).toBeNull();
  });

  it("returns the estimate when kcal look like a typo", () => {
    // 12.6 × 4 + 3.3 × 9 + 57.1 × 4 = 308.5
    expect(kcalMismatchEstimate({ ...buckwheat, kcal100: "31" })).toBeCloseTo(308.5, 10);
  });

  it("counts typed fiber", () => {
    // 1 × 4 + 0.7 × 9 + 5.4 × 4 + 6.5 × 2 = 44.9 — matches raspberries' 52 kcal within 20 kcal.
    expect(
      kcalMismatchEstimate({
        kcal100: "52",
        protein100: "1",
        fat100: "0,7",
        carbs100: "5,4",
        fiber100: "6,5",
      }),
    ).toBeNull();
  });

  it.each([
    { ...buckwheat, kcal100: "" },
    { ...buckwheat, protein100: "abc" },
    { ...buckwheat, carbs100: " " },
  ])("waits until kcal, protein, fat and carbs are numbers", (values) => {
    expect(kcalMismatchEstimate(values)).toBeNull();
  });
});

describe("quickKcalMismatchEstimate", () => {
  it("returns the estimate when typed macros give far more kcal", () => {
    // 100 g protein × 4 = 400 kcal, typed 50
    expect(quickKcalMismatchEstimate({ kcal: "50", proteinG: "100", fatG: "", carbsG: "" })).toBe(
      400,
    );
  });

  it("stays quiet when the macros agree, empty ones counting as 0", () => {
    // 90 × 4 = 360
    expect(
      quickKcalMismatchEstimate({ kcal: "360", proteinG: "90", fatG: "", carbsG: "" }),
    ).toBeNull();
  });

  it("stays quiet for just kcal, no macros typed", () => {
    expect(
      quickKcalMismatchEstimate({ kcal: "50", proteinG: "", fatG: "", carbsG: "" }),
    ).toBeNull();
  });

  it("stays quiet while a number is unfinished or broken", () => {
    expect(
      quickKcalMismatchEstimate({ kcal: "", proteinG: "100", fatG: "", carbsG: "" }),
    ).toBeNull();
    expect(
      quickKcalMismatchEstimate({ kcal: "50", proteinG: "abc", fatG: "", carbsG: "" }),
    ).toBeNull();
  });
});
