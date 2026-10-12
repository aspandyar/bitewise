import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DIARY_LIMITS } from "@/lib/config";
import {
  addEntryFormSchema,
  parseDiaryDate,
  parseId,
  parseMeal,
  toAddAmount,
  toUpdateAmount,
  updateEntryFormSchema,
} from "./schema";

const portionId = randomUUID();

function errorPaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("addEntryFormSchema", () => {
  it("parses grams with a decimal comma", () => {
    const parsed = addEntryFormSchema.parse({ meal: "lunch", mode: "grams", grams: "150,5" });
    expect(toAddAmount(parsed)).toEqual({ mode: "grams", grams: 150.5 });
    expect(parsed.meal).toBe("lunch");
  });

  it("parses a portion with a fractional count", () => {
    const parsed = addEntryFormSchema.parse({
      meal: "dinner",
      mode: "portion",
      portionId,
      count: "1,5",
    });
    expect(toAddAmount(parsed)).toEqual({ mode: "portion", portionId, count: 1.5 });
  });

  it("rounds a count to the stored precision", () => {
    const parsed = addEntryFormSchema.parse({
      meal: "snack",
      mode: "portion",
      portionId,
      count: "0,333",
    });
    expect(toAddAmount(parsed)).toEqual({ mode: "portion", portionId, count: 0.33 });
  });

  it.each(["0", "0,05", String(DIARY_LIMITS.grams.max + 1), "", "abc"])(
    "rejects grams %j on the grams field",
    (grams) => {
      const result = addEntryFormSchema.safeParse({ meal: "lunch", mode: "grams", grams });
      expect(errorPaths(result)).toContain("grams");
    },
  );

  it.each(["0", "0,2", String(DIARY_LIMITS.portionCount.max + 1), ""])(
    "rejects count %j on the count field",
    (count) => {
      const result = addEntryFormSchema.safeParse({
        meal: "lunch",
        mode: "portion",
        portionId,
        count,
      });
      expect(errorPaths(result)).toContain("count");
    },
  );

  it("requires a portion id in portion mode", () => {
    const result = addEntryFormSchema.safeParse({ meal: "lunch", mode: "portion", count: "1" });
    expect(errorPaths(result)).toContain("portionId");
  });

  it("rejects an unknown meal", () => {
    const result = addEntryFormSchema.safeParse({ meal: "brunch", mode: "grams", grams: "100" });
    expect(errorPaths(result)).toContain("meal");
  });
});

describe("updateEntryFormSchema", () => {
  it("accepts a portion count without a portion id", () => {
    const parsed = updateEntryFormSchema.parse({ meal: "breakfast", mode: "portion", count: "2" });
    expect(toUpdateAmount(parsed)).toEqual({ mode: "portion", count: 2 });
  });

  it("accepts grams", () => {
    const parsed = updateEntryFormSchema.parse({ meal: "breakfast", mode: "grams", grams: "80" });
    expect(toUpdateAmount(parsed)).toEqual({ mode: "grams", grams: 80 });
  });
});

describe("parseDiaryDate", () => {
  const today = "2026-10-11";

  it.each([today, "2026-10-10", DIARY_LIMITS.minDate])("accepts %s", (date) => {
    expect(parseDiaryDate(date, today)).toBe(date);
  });

  it.each([
    "2026-10-12",
    "1999-12-31",
    "2026-02-30",
    "11.10.2026",
    "",
    undefined,
    ["2026-10-10", "2026-10-09"],
  ])("rejects %j", (value) => {
    expect(parseDiaryDate(value, today)).toBeNull();
  });
});

describe("parseMeal and parseId", () => {
  it("parses known meals only", () => {
    expect(parseMeal("dinner")).toBe("dinner");
    expect(parseMeal("brunch")).toBeNull();
    expect(parseMeal(undefined)).toBeNull();
  });

  it("parses uuids only", () => {
    expect(parseId(portionId)).toBe(portionId);
    expect(parseId("1")).toBeNull();
  });
});
