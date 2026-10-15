import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDayLabel,
  formatEntryAmount,
  formatGrams,
  formatGramsAtLeast,
  formatInputNumber,
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

describe("formatGramsAtLeast", () => {
  it("rounds a minimum up, so typing the shown number passes the check", () => {
    expect(formatGramsAtLeast(156.2)).toBe("157");
  });

  it("keeps a whole minimum as is", () => {
    expect(formatGramsAtLeast(200)).toBe("200");
  });

  it("groups thousands like other numbers in messages", () => {
    expect(formatGramsAtLeast(12_345.6)).toBe("12\u00a0346");
  });
});

describe("formatInputNumber", () => {
  it("prefills a stored value with a decimal comma and its full precision", () => {
    expect(formatInputNumber(11.73)).toBe("11,73");
  });

  it("keeps whole numbers and large values unbroken", () => {
    expect(formatInputNumber(20000)).toBe("20000");
  });

  it.each([null, undefined])("leaves %j empty", (value) => {
    expect(formatInputNumber(value)).toBe("");
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

// The unit is joined with a no-break space, so "75 г" never splits across lines.
describe("formatEntryAmount", () => {
  it("shows grams for a grams entry", () => {
    expect(formatEntryAmount({ grams: 150.4, portionLabel: null, portionCount: null })).toBe(
      "150\u00a0г",
    );
  });

  it("shows a single portion without a multiplier", () => {
    expect(formatEntryAmount({ grams: 60, portionLabel: "1 шт", portionCount: 1 })).toBe(
      "1 шт · 60\u00a0г",
    );
  });

  it("shows a fractional count with its grams", () => {
    expect(formatEntryAmount({ grams: 90, portionLabel: "1 шт", portionCount: 1.5 })).toBe(
      "1,5 × 1 шт · 90\u00a0г",
    );
  });

  it("keeps a label with its own brackets free of double brackets", () => {
    expect(
      formatEntryAmount({ grams: 75, portionLabel: "1 шт (крупное)", portionCount: 1.5 }),
    ).toBe("1,5 × 1 шт (крупное) · 75\u00a0г");
  });
});
