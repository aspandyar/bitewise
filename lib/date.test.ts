import { describe, expect, it } from "vitest";
import {
  daysBetween,
  addDays,
  hourInTimeZone,
  isValidTimeZone,
  parseIsoDate,
  todayInTimeZone,
  todayIsoDate,
} from "./date";

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

describe("todayInTimeZone", () => {
  const evening = new Date("2026-10-10T20:30:00Z");

  it("is already the next day in Almaty (UTC+5)", () => {
    expect(todayInTimeZone(evening, "Asia/Almaty")).toBe("2026-10-11");
  });

  it("is the same day in UTC", () => {
    expect(todayInTimeZone(evening, "UTC")).toBe("2026-10-10");
  });

  it("is the previous day west of UTC", () => {
    expect(todayInTimeZone(new Date("2026-10-11T02:00:00Z"), "America/New_York")).toBe(
      "2026-10-10",
    );
  });
});

describe("addDays", () => {
  it.each([
    { date: "2026-10-31", days: 1, expected: "2026-11-01" },
    { date: "2026-01-01", days: -1, expected: "2025-12-31" },
    { date: "2024-02-28", days: 1, expected: "2024-02-29" },
    { date: "2024-03-01", days: -1, expected: "2024-02-29" },
    { date: "2025-03-01", days: -1, expected: "2025-02-28" },
    { date: "2026-10-11", days: 0, expected: "2026-10-11" },
  ])("$date + $days = $expected", ({ date, days, expected }) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it("throws RangeError for an invalid date", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("isValidTimeZone", () => {
  it.each(["Asia/Almaty", "Europe/Moscow", "UTC"])("accepts %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each(["Mars/Base", "", "Asia/Almaty; path=/"])("rejects %j", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("hourInTimeZone", () => {
  const now = new Date("2026-10-15T05:30:00Z");

  it("reads the hour in the given zone", () => {
    expect(hourInTimeZone(now, "Asia/Almaty")).toBe(10);
    expect(hourInTimeZone(now, "Europe/Moscow")).toBe(8);
  });

  it("counts midnight as 0, not 24", () => {
    expect(hourInTimeZone(new Date("2026-10-15T00:10:00Z"), "UTC")).toBe(0);
  });
});

describe("daysBetween", () => {
  it("counts calendar days from one date to another", () => {
    expect(daysBetween("2026-10-20", "2026-10-20")).toBe(0);
    expect(daysBetween("2026-10-20", "2026-10-27")).toBe(7);
    expect(daysBetween("2026-10-27", "2026-10-20")).toBe(-7);
  });

  it("crosses month and year ends", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});
