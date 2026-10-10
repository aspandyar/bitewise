import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSeedFoods, collectUsdaNutrients, parseCsvLine } from "./usda";

const fixture = readFileSync("tests/fixtures/usda/food_nutrient.csv", "utf8").split(/\r?\n/);

describe("parseCsvLine", () => {
  it("splits quoted fields and keeps commas and doubled quotes inside them", () => {
    expect(parseCsvLine('"1","a, b","say ""hi""",""')).toEqual(["1", "a, b", 'say "hi"', ""]);
  });

  it("throws on an unterminated quote", () => {
    expect(() => parseCsvLine('"1","oops')).toThrow();
  });
});

describe("collectUsdaNutrients", () => {
  it("keeps only requested foods and known nutrients", () => {
    const nutrients = collectUsdaNutrients(fixture, new Set([170286, 999001]));
    expect(nutrients.get(170286)).toEqual({
      kcal: 343,
      protein: 13.25,
      fat: 3.4,
      carbsByDifference: 71.5,
      fiber: 10,
    });
    expect(nutrients.get(999001)).toEqual({
      kcal: 52,
      protein: 0.26,
      fat: 0.17,
      carbsByDifference: 13.81,
    });
    expect(nutrients.has(555555)).toBe(false);
  });

  it("fails on a row with the wrong number of columns", () => {
    const broken = [fixture[0] ?? "", '"1","170286","1008"'];
    expect(() => collectUsdaNutrients(broken, new Set([170286]))).toThrow(/line 2/);
  });
});

describe("buildSeedFoods", () => {
  const nutrients = collectUsdaNutrients(fixture, new Set([170286, 999001, 999002]));

  it("builds net carbs, keeps fiber and sorts by key", () => {
    const seed = buildSeedFoods(
      [
        { fdcId: 999001, name: "Яблоко", portions: [] },
        {
          fdcId: 170286,
          name: "Гречка, крупа сухая",
          portions: [{ label: "1 ст. л.", grams: 12 }],
        },
      ],
      [
        {
          slug: "ryazhenka-4",
          name: "Ряженка 4 %",
          kcal100: 67,
          protein100: 2.8,
          fat100: 4,
          carbs100: 4.2,
          fiber100: null,
          sourceUrl: "https://example.com/ryazhenka",
          portions: [],
        },
      ],
      nutrients,
    );
    expect(seed.map((food) => food.key)).toEqual([
      "label:ryazhenka-4",
      "usda:170286",
      "usda:999001",
    ]);
    expect(seed[1]).toEqual({
      key: "usda:170286",
      name: "Гречка, крупа сухая",
      source: "usda",
      kcal100: 343,
      protein100: 13.25,
      fat100: 3.4,
      carbs100: 61.5,
      fiber100: 10,
      sourceUrl: null,
      portions: [{ label: "1 ст. л.", grams: 12 }],
    });
    expect(seed[2]).toMatchObject({ carbs100: 13.81, fiber100: null });
    expect(seed[0]).toMatchObject({ source: "label", sourceUrl: "https://example.com/ryazhenka" });
  });

  it("rounds to the stored precision", () => {
    const seed = buildSeedFoods(
      [{ fdcId: 170286, name: "x", portions: [] }],
      [],
      // 1.006 rather than 1.005: the latter is 1.00499… in binary and would round down.
      new Map([
        [170286, { kcal: 1.006, protein: 1.234, fat: 0, carbsByDifference: 0.3, fiber: 0.1 }],
      ]),
    );
    expect(seed[0]).toMatchObject({ kcal100: 1.01, protein100: 1.23, carbs100: 0.2 });
  });

  it("fails loudly on an unknown fdcId or missing macros instead of writing zeros", () => {
    expect(() =>
      buildSeedFoods([{ fdcId: 123, name: "Нет", portions: [] }], [], nutrients),
    ).toThrow(/usda:123/);
    expect(() =>
      buildSeedFoods([{ fdcId: 999002, name: "Неполный", portions: [] }], [], nutrients),
    ).toThrow(/usda:999002.*protein/);
  });
});
