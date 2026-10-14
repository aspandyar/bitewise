import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DIARY_LIMITS, PORTION_LIMITS } from "@/lib/config";
import {
  addAmountSchema,
  isStorableGrams,
  toAddAmount,
  toAmountColumns,
  toUpdateAmount,
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
