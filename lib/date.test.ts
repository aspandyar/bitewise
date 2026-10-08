import { describe, expect, it } from "vitest";
import { parseIsoDate, todayIsoDate } from "./date";

describe("parseIsoDate", () => {
  it("parses a valid calendar date", () => {
    expect(parseIsoDate("2026-10-09")).toEqual({ year: 2026, month: 10, day: 9 });
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "26-10-09", "2026-10-9", ""])(
    "returns null for %j",
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );
});

describe("todayIsoDate", () => {
  it("formats the UTC calendar date", () => {
    expect(todayIsoDate(new Date("2026-10-09T23:30:00Z"))).toBe("2026-10-09");
  });
});
