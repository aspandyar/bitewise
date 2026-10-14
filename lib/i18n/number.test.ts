import { describe, expect, it } from "vitest";
import { formatNumber } from "./number";
import { ru } from "./ru";

// Intl separates thousands with a no-break space, so a number never wraps across lines.
const NBSP = "\u00a0";

describe("numbers in messages", () => {
  it("writes decimals with a comma", () => {
    expect(ru.errors.gramsRange(0.1, 5000)).toBe("От 0,1 до 5000 г");
  });

  it("groups thousands from five digits up", () => {
    expect(ru.errors.cookedWeight(0.1, 20_000)).toBe(`Вес — от 0,1 до 20${NBSP}000 г`);
  });

  it("formats limits in counters too", () => {
    expect(ru.diary.entryTotalLimit(100_000)).toBe(`Не больше 100${NBSP}000 записей в дневнике`);
  });
});

describe("formatNumber", () => {
  it("keeps at most the stored precision", () => {
    expect(formatNumber(0.125)).toBe("0,13");
  });
});
