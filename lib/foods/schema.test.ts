import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FOOD_LIMITS, PORTION_LIMITS } from "@/lib/config";
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { foodSchema, parseDraftName, parseFoodId, portionSchema } from "./schema";

const valid = {
  name: " Гречка ",
  kcal100: "313",
  protein100: "12,6",
  fat100: "3,3",
  carbs100: "57,1",
  fiber100: "",
};

describe("foodSchema", () => {
  it("parses a valid form with decimal commas and an empty fiber", () => {
    expect(foodSchema.parse(valid)).toEqual({
      name: "Гречка",
      kcal100: 313,
      protein100: 12.6,
      fat100: 3.3,
      carbs100: 57.1,
      fiber100: null,
    });
  });

  it("keeps fiber of 0 as 0", () => {
    expect(foodSchema.parse({ ...valid, fiber100: "0" }).fiber100).toBe(0);
  });

  it("rejects a blank or too long name", () => {
    expect(foodSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
    const long = "а".repeat(FOOD_LIMITS.nameLength.max + 1);
    expect(foodSchema.safeParse({ ...valid, name: long }).success).toBe(false);
  });

  it("rejects kcal above the limit and negative grams", () => {
    expect(foodSchema.safeParse({ ...valid, kcal100: "901" }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, fat100: "-1" }).success).toBe(false);
  });

  it("rejects macros summing to more than 100 g, reporting it on carbs", () => {
    const result = foodSchema.safeParse({
      ...valid,
      protein100: "50",
      fat100: "40",
      carbs100: "20",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["carbs100"]);
  });

  it("counts fiber in the 100 g sum", () => {
    const over = { ...valid, protein100: "40", fat100: "30", carbs100: "25", fiber100: "6" };
    expect(foodSchema.safeParse(over).success).toBe(false);
  });

  it("accepts a sum of exactly 100 g despite float error", () => {
    const exact = { ...valid, protein100: "33,3", fat100: "33,3", carbs100: "33,4", fiber100: "" };
    expect(foodSchema.safeParse(exact).success).toBe(true);
  });
});

describe("portionSchema", () => {
  it("parses a label and grams", () => {
    expect(portionSchema.parse({ label: " 1 шт ", grams: "55,5" })).toEqual({
      label: "1 шт",
      grams: 55.5,
    });
  });

  it("rejects grams outside the limits and a blank label", () => {
    expect(portionSchema.safeParse({ label: "x", grams: "0" }).success).toBe(false);
    const tooMuch = String(PORTION_LIMITS.grams.max + 1);
    expect(portionSchema.safeParse({ label: "x", grams: tooMuch }).success).toBe(false);
    expect(portionSchema.safeParse({ label: " ", grams: "10" }).success).toBe(false);
  });
});

describe("parseFoodId", () => {
  it("accepts a uuid", () => {
    const id = randomUUID();
    expect(parseFoodId(id)).toBe(id);
  });

  it("returns null for garbage instead of letting it reach Postgres", () => {
    expect(parseFoodId("abc")).toBeNull();
    expect(parseFoodId("1; drop table foods")).toBeNull();
    expect(parseFoodId(undefined)).toBeNull();
  });
});

describe("empty required fields", () => {
  it("asks to fill in the food's name and numbers", () => {
    const parsed = foodSchema.safeParse({ ...valid, name: " ", kcal100: "", protein100: "" });
    expect(parsed.error && firstFieldErrors(parsed.error)).toMatchObject({
      name: ru.errors.enter.name,
      kcal100: ru.errors.enter.kcal,
      protein100: ru.errors.enter.grams,
    });
  });

  it("asks to fill in a portion's label and grams", () => {
    const parsed = portionSchema.safeParse({ label: "", grams: "" });
    expect(parsed.error && firstFieldErrors(parsed.error)).toEqual({
      label: ru.errors.enter.portionLabel,
      grams: ru.errors.enter.grams,
    });
  });
});

describe("parseDraftName", () => {
  it("takes a search query as the new food's name with a capital letter", () => {
    expect(parseDraftName("  гречка зелёная ")).toBe("Гречка зелёная");
  });

  it("keeps a leading emoji whole", () => {
    expect(parseDraftName("🍎 яблоко")).toBe("🍎 яблоко");
  });

  it.each([undefined, "", "   ", ["a", "b"]])("gives no name for %j", (value) => {
    expect(parseDraftName(value)).toBeUndefined();
  });

  it("gives no name for a value longer than a food name may be", () => {
    expect(parseDraftName("а".repeat(FOOD_LIMITS.nameLength.max + 1))).toBeUndefined();
  });
});
