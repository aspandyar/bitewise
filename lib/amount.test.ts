import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DIARY_LIMITS, PORTION_LIMITS } from "@/lib/config";
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import {
  addAmountSchema,
  isStorableGrams,
  previewKcal,
  portionToPick,
  toAddAmount,
  toAmountColumns,
  toUpdateAmount,
  toUpdatedAmountColumns,
  updateAmountSchema,
} from "./amount";

const portionId = randomUUID();

describe("addAmountSchema", () => {
  it("parses grams with a decimal comma", () => {
    expect(toAddAmount(addAmountSchema.parse({ mode: "grams", grams: "150,5" }))).toEqual({
      mode: "grams",
      grams: 150.5,
    });
  });

  it("parses a portion and rounds the count to stored precision", () => {
    const parsed = addAmountSchema.parse({ mode: "portion", portionId, count: "0,333" });
    expect(toAddAmount(parsed)).toEqual({ mode: "portion", portionId, count: 0.33 });
  });

  it("rejects a portion without an id", () => {
    expect(addAmountSchema.safeParse({ mode: "portion", count: "1" }).success).toBe(false);
  });
});

describe("updateAmountSchema", () => {
  it("parses a count without a portion id", () => {
    expect(toUpdateAmount(updateAmountSchema.parse({ mode: "portion", count: "2" }))).toEqual({
      mode: "portion",
      count: 2,
    });
  });

  it("parses a count with a newly picked portion", () => {
    expect(
      toUpdateAmount(updateAmountSchema.parse({ mode: "portion", portionId, count: "1,5" })),
    ).toEqual({ mode: "portion", portionId, count: 1.5 });
  });
});

describe("toAmountColumns", () => {
  it("stores grams without a portion", () => {
    expect(toAmountColumns({ mode: "grams", grams: 80 }, null)).toEqual({
      grams: 80,
      portionLabel: null,
      portionGrams: null,
      portionCount: null,
    });
  });

  it("stores a portion snapshot and grams = count × portion grams", () => {
    expect(
      toAmountColumns({ mode: "portion", portionId, count: 2 }, { label: "1 шт", grams: 60 }),
    ).toEqual({ grams: 120, portionLabel: "1 шт", portionGrams: 60, portionCount: 2 });
  });

  it("throws on a portion amount without a portion", () => {
    expect(() => toAmountColumns({ mode: "portion", portionId, count: 1 }, null)).toThrow();
  });
});

describe("isStorableGrams", () => {
  it.each([DIARY_LIMITS.grams.min, 150, DIARY_LIMITS.grams.max])("accepts %d g", (grams) => {
    expect(isStorableGrams(grams)).toBe(true);
  });

  it("rejects a big portion times many, which a grams entry could not hold", () => {
    expect(isStorableGrams(PORTION_LIMITS.grams.max * 2)).toBe(false);
  });

  it("rejects a tiny portion split in quarters", () => {
    expect(isStorableGrams(PORTION_LIMITS.grams.min * DIARY_LIMITS.portionCount.min)).toBe(false);
  });
});

describe("empty amount fields", () => {
  it("asks to fill in grams", () => {
    const parsed = addAmountSchema.safeParse({ mode: "grams", grams: "" });
    expect(parsed.error && firstFieldErrors(parsed.error)).toEqual({
      grams: ru.errors.enter.grams,
    });
  });

  it("asks to fill in the count", () => {
    const parsed = updateAmountSchema.safeParse({ mode: "portion", count: " " });
    expect(parsed.error && firstFieldErrors(parsed.error)).toEqual({
      count: ru.errors.enter.count,
    });
  });
});

describe("toUpdatedAmountColumns", () => {
  const plate = { label: "тарелка", grams: 250 };

  it("drops the portion for a grams amount", () => {
    expect(toUpdatedAmountColumns({ mode: "grams", grams: 80 }, 60, null)).toEqual({
      grams: 80,
      portionLabel: null,
      portionGrams: null,
      portionCount: null,
    });
  });

  it("multiplies the snapshot by the new count", () => {
    expect(toUpdatedAmountColumns({ mode: "portion", count: 3 }, 60, null)).toEqual({
      grams: 180,
      portionCount: 3,
    });
  });

  it("snapshots a portion picked for a grams amount", () => {
    expect(toUpdatedAmountColumns({ mode: "portion", portionId, count: 2 }, null, plate)).toEqual({
      grams: 500,
      portionLabel: "тарелка",
      portionGrams: 250,
      portionCount: 2,
    });
  });

  it("has nothing to count for a grams amount without a picked portion", () => {
    expect(toUpdatedAmountColumns({ mode: "portion", count: 2 }, null, null)).toBeNull();
  });
});

describe("portionToPick", () => {
  it("picks only for a grams amount switching to a portion", () => {
    expect(portionToPick({ mode: "portion", portionId, count: 1 }, null)).toBe(portionId);
  });

  it("ignores a portion id sent for an amount that already has a snapshot", () => {
    expect(portionToPick({ mode: "portion", portionId, count: 1 }, 60)).toBeNull();
  });

  it("has nothing to pick for grams", () => {
    expect(portionToPick({ mode: "grams", grams: 10 }, null)).toBeNull();
  });
});

describe("previewKcal", () => {
  const oats = { kcal100: 350, protein100: 12, fat100: 6, carbs100: 60 };

  it("prices typed grams", () => {
    expect(previewKcal(oats, { mode: "grams", grams: "60" })).toBe(210);
  });

  it("prices a portion times its count", () => {
    // 2 × 40 g = 80 g × 3.5 kcal/g = 280
    expect(previewKcal(oats, { mode: "portion", portionGrams: 40, count: "2" })).toBe(280);
  });

  it.each([
    { mode: "grams" as const, grams: "" },
    { mode: "grams" as const, grams: "0" },
    { mode: "grams" as const, grams: "abc" },
    { mode: "portion" as const, portionGrams: 40, count: "" },
    { mode: "portion" as const, portionGrams: null, count: "1" },
  ])("has nothing to show for %j", (amount) => {
    expect(previewKcal(oats, amount)).toBeNull();
  });
});
