import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDayLabel,
  formatEntryAmount,
  formatGrams,
  formatKcal,
  isOverTarget,
} from "./format";

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

describe("isOverTarget", () => {
  it("is not over when the overshoot rounds to 0", () => {
    expect(isOverTarget(-0.3)).toBe(false);
  });

  it("is over once the overshoot shows as at least 1", () => {
    expect(isOverTarget(-0.6)).toBe(true);
  });

  it("is not over with something left", () => {
    expect(isOverTarget(12)).toBe(false);
  });
});

describe("formatAmount", () => {
  it.each([
    { count: 1, expected: "1" },
    { count: 1.5, expected: "1,5" },
    { count: 0.25, expected: "0,25" },
    { count: 2.0, expected: "2" },
  ])("formats $count as $expected", ({ count, expected }) => {
    expect(formatAmount(count)).toBe(expected);
  });
});

describe("formatDayLabel", () => {
  const today = "2026-10-11";

  it("names today and yesterday", () => {
    expect(formatDayLabel(today, today)).toBe("Сегодня");
    expect(formatDayLabel("2026-10-10", today)).toBe("Вчера");
  });

  it("shows day, month and weekday within the current year", () => {
    // 2026-10-09 is a Friday
    expect(formatDayLabel("2026-10-09", today)).toBe("9 окт, пт");
    expect(formatDayLabel("2026-05-09", today)).toBe("9 мая, сб");
  });

  it("adds the year for another year", () => {
    // 2025-12-31 is a Wednesday
    expect(formatDayLabel("2025-12-31", today)).toBe("31 дек 2025, ср");
  });
});

describe("formatEntryAmount", () => {
  it("shows grams for a grams entry", () => {
    expect(formatEntryAmount({ grams: 150.4, portionLabel: null, portionCount: null })).toBe(
      "150 г",
    );
  });

  it("shows a single portion without a multiplier", () => {
    expect(formatEntryAmount({ grams: 60, portionLabel: "1 шт", portionCount: 1 })).toBe(
      "1 шт (60 г)",
    );
  });

  it("shows a fractional count with its grams", () => {
    expect(formatEntryAmount({ grams: 90, portionLabel: "1 шт", portionCount: 1.5 })).toBe(
      "1,5 × 1 шт (90 г)",
    );
  });
});
