import { describe, expect, it } from "vitest";
import { formatGrams, formatKcal } from "./format";

describe("formatKcal", () => {
  it("hides floating-point noise", () => {
    expect(formatKcal(2759.0000000000005)).toBe("2759");
  });

  it("rounds half up", () => {
    expect(formatKcal(2345.5)).toBe("2346");
  });
});

describe("formatGrams", () => {
  it("rounds to whole grams", () => {
    expect(formatGrams(82.77)).toBe("83");
  });

  it("shows 0 for 0 g", () => {
    expect(formatGrams(0)).toBe("0");
  });
});
