import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DIARY_LIMITS } from "@/lib/config";
import { lastAmount, mealForHour, parseAddError, parseUndoIds, repeatSummary } from "./quick";

describe("mealForHour", () => {
  it.each([
    [0, "breakfast"],
    [10, "breakfast"],
    [11, "lunch"],
    [15, "lunch"],
    [16, "dinner"],
    [20, "dinner"],
    [21, "snack"],
    [23, "snack"],
  ] as const)("hour %d → %s", (hour, meal) => {
    expect(mealForHour(hour)).toBe(meal);
  });
});

describe("repeatSummary", () => {
  it("names all foods when they fit", () => {
    expect(repeatSummary(["Овсянка", "Кофе"])).toEqual({ shown: ["Овсянка", "Кофе"], more: 0 });
  });

  it("counts the rest", () => {
    expect(repeatSummary(["Овсянка", "Кофе", "Банан", "Мёд"])).toEqual({
      shown: ["Овсянка", "Кофе"],
      more: 2,
    });
  });
});

describe("parseUndoIds", () => {
  const a = randomUUID();
  const b = randomUUID();

  it("reads a comma list of ids", () => {
    expect(parseUndoIds(`${a},${b}`)).toEqual([a, b]);
  });

  it.each([null, "", "x", `${a},nope`])("rejects %j", (value) => {
    expect(parseUndoIds(value)).toBeNull();
  });

  it("rejects more ids than a day can hold", () => {
    const many = Array.from({ length: DIARY_LIMITS.maxEntriesPerDay + 1 }, () => randomUUID());
    expect(parseUndoIds(many.join(","))).toBeNull();
  });
});

describe("lastAmount", () => {
  it("repeats grams", () => {
    expect(
      lastAmount({ grams: 60, portionLabel: null, portionGrams: null, portionCount: null }),
    ).toEqual({ grams: 60, portionLabel: null, portionGrams: null, portionCount: null });
  });

  it("recomputes grams from the portion snapshot and its count", () => {
    expect(
      lastAmount({ grams: 999, portionLabel: "1 шт", portionGrams: 60, portionCount: 2 }),
    ).toEqual({ grams: 120, portionLabel: "1 шт", portionGrams: 60, portionCount: 2 });
  });
});

describe("parseAddError", () => {
  it.each(["limit", "totalLimit", "gone"] as const)("reads %s", (value) => {
    expect(parseAddError(value)).toBe(value);
  });

  it.each([undefined, "", "<b>oops</b>", ["limit"]])("ignores %j", (value) => {
    expect(parseAddError(value)).toBeNull();
  });
});
