import { describe, expect, it } from "vitest";
import { FOOD_SEARCH } from "@/lib/config";
import { parseSearchQuery, withSearchQuery } from "./search-query";

describe("parseSearchQuery", () => {
  it("keeps a typed query as it was, trimmed", () => {
    expect(parseSearchQuery("  гречка ")).toBe("гречка");
  });

  it("drops what is not a usable query", () => {
    expect(parseSearchQuery(undefined)).toBeUndefined();
    expect(parseSearchQuery("   ")).toBeUndefined();
    expect(parseSearchQuery(["a", "b"])).toBeUndefined();
    expect(parseSearchQuery("я".repeat(FOOD_SEARCH.maxQueryLength + 1))).toBeUndefined();
  });
});

describe("withSearchQuery", () => {
  it("adds the query to a bare path and to one with parameters", () => {
    expect(withSearchQuery("/foods", "овсянка")).toBe(
      "/foods?q=%D0%BE%D0%B2%D1%81%D1%8F%D0%BD%D0%BA%D0%B0",
    );
    expect(withSearchQuery("/diary/add?date=2026-10-21&meal=breakfast", "кофе & сахар")).toBe(
      "/diary/add?date=2026-10-21&meal=breakfast&q=%D0%BA%D0%BE%D1%84%D0%B5+%26+%D1%81%D0%B0%D1%85%D0%B0%D1%80",
    );
  });

  it("leaves the path alone without a query", () => {
    expect(withSearchQuery("/foods", undefined)).toBe("/foods");
  });
});
