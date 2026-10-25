import { describe, expect, it } from "vitest";
import { parseWaterMl } from "./schema";

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
