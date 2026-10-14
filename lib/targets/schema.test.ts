import { describe, expect, it } from "vitest";
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { targetsSchema } from "./schema";

describe("targets schema", () => {
  it("parses decimal strings", () => {
    expect(
      targetsSchema.parse({ kcal: "2200", proteinG: "140,5", fatG: "70", carbsG: "0" }),
    ).toEqual({ kcal: 2200, proteinG: 140.5, fatG: 70, carbsG: 0 });
  });

  it.each([
    ["kcal", "799"],
    ["kcal", "6001"],
    ["proteinG", ""],
    ["fatG", "-1"],
    ["carbsG", "1001"],
  ])("rejects %s = %j", (field, value) => {
    const input = { kcal: "2200", proteinG: "140", fatG: "70", carbsG: "250", [field]: value };
    expect(targetsSchema.safeParse(input).success).toBe(false);
  });
});

describe("empty targets fields", () => {
  it("asks to fill in kcal and grams", () => {
    const parsed = targetsSchema.safeParse({ kcal: "", proteinG: "", fatG: "70", carbsG: "250" });
    expect(parsed.error && firstFieldErrors(parsed.error)).toEqual({
      kcal: ru.errors.enter.kcal,
      proteinG: ru.errors.enter.grams,
    });
  });
});
