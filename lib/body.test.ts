import { describe, expect, it } from "vitest";
import { calcWeightTrend } from "./body";

describe("calcWeightTrend", () => {
  it("returns nothing for no weigh-ins", () => {
    expect(calcWeightTrend([])).toEqual([]);
  });

  it("averages a single weigh-in to itself", () => {
    expect(calcWeightTrend([{ date: "2026-10-20", weightKg: 80 }])).toEqual([
      { date: "2026-10-20", weightKg: 80, averageKg: 80 },
    ]);
  });

  it("averages the weigh-ins of the 7 days ending on each one, skipping gaps", () => {
    // 10-20: 80 → 80
    // 10-22: (80 + 79) / 2 = 79.5
    // 10-26: window 10-20…10-26 → (80 + 79 + 78.4) / 3 = 79.133…
    // 10-27: window 10-21…10-27 → 10-20 drops out → (79 + 78.4 + 78) / 3 = 78.466…
    const trend = calcWeightTrend([
      { date: "2026-10-27", weightKg: 78 },
      { date: "2026-10-20", weightKg: 80 },
      { date: "2026-10-26", weightKg: 78.4 },
      { date: "2026-10-22", weightKg: 79 },
    ]);
    expect(trend.map((point) => point.date)).toEqual([
      "2026-10-20",
      "2026-10-22",
      "2026-10-26",
      "2026-10-27",
    ]);
    expect(trend[0]!.averageKg).toBe(80);
    expect(trend[1]!.averageKg).toBe(79.5);
    expect(trend[2]!.averageKg).toBeCloseTo(79.133, 3);
    expect(trend[3]!.averageKg).toBeCloseTo(78.467, 3);
  });
});
