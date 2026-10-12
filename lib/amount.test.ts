import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addAmountSchema,
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
