import { describe, expect, it } from "vitest";
import { parsePeriod } from "./schema";

describe("parsePeriod", () => {
  it("reads a known period", () => {
    expect(parsePeriod("week")).toBe("week");
    expect(parsePeriod("month")).toBe("month");
  });

  it("falls back to a week for anything else", () => {
    for (const value of [undefined, "", "year", ["month"], 7]) {
      expect(parsePeriod(value)).toBe("week");
    }
  });
});
