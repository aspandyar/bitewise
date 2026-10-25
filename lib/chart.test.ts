import { describe, expect, it } from "vitest";
import { linearScale, paddedDomain } from "./chart";

describe("paddedDomain", () => {
  it("keeps a span wider than the minimum as is", () => {
    expect(paddedDomain([78, 81, 79], 2)).toEqual([78, 81]);
  });

  it("widens a narrow span around its middle", () => {
    // 79.6…80 is 0.4 wide, middle 79.8 → 78.8…80.8
    expect(paddedDomain([80, 79.6], 2)).toEqual([78.8, 80.8]);
  });

  it("centres a single value", () => {
    expect(paddedDomain([80], 2)).toEqual([79, 81]);
  });

  it("returns null for no values", () => {
    expect(paddedDomain([], 2)).toBeNull();
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range", () => {
    const x = linearScale([0, 10], [20, 320]);
    expect(x(0)).toBe(20);
    expect(x(5)).toBe(170);
    expect(x(10)).toBe(320);
  });

  it("maps onto a reversed range, as SVG's Y axis grows downwards", () => {
    const y = linearScale([78, 82], [200, 0]);
    expect(y(78)).toBe(200);
    expect(y(80)).toBe(100);
    expect(y(82)).toBe(0);
  });

  it("puts every value in the middle of an empty domain", () => {
    const x = linearScale([3, 3], [0, 300]);
    expect(x(3)).toBe(150);
  });
});
