import { describe, expect, it } from "vitest";
import { calcWaterShare, parseWaterMl } from "./schema";

describe("parseWaterMl", () => {
  it("accepts the quick amounts, from a form field or a number", () => {
    expect(parseWaterMl("250")).toBe(250);
    expect(parseWaterMl(500)).toBe(500);
  });

  it("refuses any other amount", () => {
    for (const value of ["0", "-250", "251", "250.5", "10000", "", "abc", null, undefined]) {
      expect(parseWaterMl(value)).toBeNull();
    }
  });
});

describe("calcWaterShare", () => {
  it("is the share of the target, capped at full", () => {
    expect(calcWaterShare(0, 2000)).toBe(0);
    expect(calcWaterShare(750, 2000)).toBe(0.375);
    expect(calcWaterShare(2000, 2000)).toBe(1);
    expect(calcWaterShare(3000, 2000)).toBe(1);
  });

  it("is empty against a zero target", () => {
    expect(calcWaterShare(500, 0)).toBe(0);
  });
});
