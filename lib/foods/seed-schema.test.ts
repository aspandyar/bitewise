import { describe, expect, it } from "vitest";
import { seedFileSchema } from "./seed-schema";

const food = {
  key: "usda:170286",
  name: "Гречка",
  source: "usda",
  kcal100: 343,
  protein100: 13.25,
  fat100: 3.4,
  carbs100: 61.5,
  fiber100: 10,
  sourceUrl: null,
  portions: [{ label: "1 ст. л.", grams: 12 }],
};

describe("seedFileSchema", () => {
  it("accepts a valid seed", () => {
    expect(seedFileSchema.parse([food])).toEqual([food]);
  });

  it("rejects duplicate keys", () => {
    expect(seedFileSchema.safeParse([food, food]).success).toBe(false);
  });

  it("rejects a key that does not match its source", () => {
    expect(seedFileSchema.safeParse([{ ...food, key: "label:grechka" }]).success).toBe(false);
  });

  it("requires a source url for label foods", () => {
    const label = { ...food, key: "label:ryazhenka-4", source: "label", sourceUrl: null };
    expect(seedFileSchema.safeParse([label]).success).toBe(false);
  });

  it("rejects out-of-range nutrients", () => {
    expect(seedFileSchema.safeParse([{ ...food, kcal100: 901 }]).success).toBe(false);
  });
});
