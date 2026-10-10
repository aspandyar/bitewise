import { describe, expect, it } from "vitest";
import { FOOD_SEARCH } from "@/lib/config";
import { escapeLike, normalizeFoodQuery } from "./search";

describe("normalizeFoodQuery", () => {
  it("trims, lowercases and collapses spaces", () => {
    expect(normalizeFoodQuery("  Гречка   ВАРЁНАЯ ")).toBe("гречка вареная");
  });

  it("folds ё and Ё into е", () => {
    expect(normalizeFoodQuery("Свёкла Ёж")).toBe("свекла еж");
  });

  it("rejects missing and blank queries", () => {
    expect(normalizeFoodQuery(null)).toBeNull();
    expect(normalizeFoodQuery("")).toBeNull();
    expect(normalizeFoodQuery("   ")).toBeNull();
  });

  it("accepts a query of exactly the max length and rejects a longer one", () => {
    expect(normalizeFoodQuery("а".repeat(FOOD_SEARCH.maxQueryLength))).toHaveLength(
      FOOD_SEARCH.maxQueryLength,
    );
    expect(normalizeFoodQuery("а".repeat(FOOD_SEARCH.maxQueryLength + 1))).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("гречка")).toBe("гречка");
  });
});
