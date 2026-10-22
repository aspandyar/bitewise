import { describe, expect, it } from "vitest";
import { SCANNER } from "@/lib/config";
import { parseFoodHints } from "./hints";
import { newFoodForCode, scanTargetHref, shouldSubmitCode } from "./scan";

const CODE = "4610169567113";
const diary = { kind: "diary" as const, date: "2026-10-22" as const, meal: "breakfast" as const };
const foods = { kind: "foods" as const };

function formParams(href: string) {
  return Object.fromEntries(new URL(href, "https://x.test").searchParams);
}

describe("shouldSubmitCode", () => {
  it("sends the first code and a different one at once", () => {
    expect(shouldSubmitCode(null, CODE, 0)).toBe(true);
    expect(shouldSubmitCode({ code: CODE, atMs: 0 }, "96385074", 100)).toBe(true);
  });

  it("holds back the same code seen again within the pause", () => {
    expect(shouldSubmitCode({ code: CODE, atMs: 0 }, CODE, 1000)).toBe(false);
    expect(shouldSubmitCode({ code: CODE, atMs: 0 }, CODE, SCANNER.sameCodeMs - 1)).toBe(false);
  });

  it("sends the same code again after the pause", () => {
    expect(shouldSubmitCode({ code: CODE, atMs: 0 }, CODE, 3100)).toBe(true);
  });
});

describe("scanTargetHref", () => {
  it("opens the amount screen of that day and meal for a found food from the diary", () => {
    expect(scanTargetHref({ status: "found", foodId: "f1" }, diary)).toBe(
      "/diary/add/f1?date=2026-10-22&meal=breakfast",
    );
  });

  it("opens the food card for a found food from the foods screen", () => {
    expect(scanTargetHref({ status: "found", foodId: "f1" }, foods)).toBe("/foods/f1");
  });

  it("opens the own-food form with the code, hints and the day for an unknown code", () => {
    const href = scanTargetHref(
      { status: "not_found", code: CODE, hints: { name: "Батончик", kcal100: 288 } },
      diary,
    );
    expect(href?.startsWith("/foods/new?")).toBe(true);
    const params = formParams(href!);
    expect(params).toMatchObject({ date: "2026-10-22", meal: "breakfast" });
    expect(parseFoodHints(params)).toEqual({
      barcode: CODE,
      hints: { name: "Батончик", kcal100: 288 },
      fromOff: true,
    });
  });

  it("credits Open Food Facts only when it gave something", () => {
    const href = scanTargetHref({ status: "not_found", code: CODE, hints: {} }, foods);
    expect(href).toBe(`/foods/new?barcode=${CODE}`);
  });

  it("stays on the scanner when Open Food Facts is down or the request failed", () => {
    expect(scanTargetHref({ status: "unavailable", code: CODE }, diary)).toBeNull();
    expect(scanTargetHref({ error: "rate_limited" }, diary)).toBeNull();
  });
});

describe("newFoodForCode", () => {
  it("opens the own-food form with just the code, keeping the day for the diary", () => {
    expect(formParams(newFoodForCode(CODE, diary))).toEqual({
      date: "2026-10-22",
      meal: "breakfast",
      barcode: CODE,
    });
    expect(newFoodForCode(CODE, foods)).toBe(`/foods/new?barcode=${CODE}`);
  });
});
