import { describe, expect, it } from "vitest";
import { newFoodHref, parseFoodHints } from "./hints";

const CODE = "4610169567113";

describe("parseFoodHints", () => {
  it("reads the code, known values and the Open Food Facts mark", () => {
    expect(
      parseFoodHints({
        barcode: CODE,
        name: "Батончик (Bombbar)",
        kcal100: "288.33",
        fat100: "7.17",
        from: "off",
      }),
    ).toEqual({
      barcode: CODE,
      hints: { name: "Батончик (Bombbar)", kcal100: 288.33, fat100: 7.17 },
      fromOff: true,
    });
  });

  it("drops what would not pass the form and an Open Food Facts mark without a code", () => {
    expect(
      parseFoodHints({
        barcode: "123",
        name: "",
        kcal100: "9000",
        protein100: "-1",
        carbs100: "abc",
        fiber100: ["1", "2"],
        from: "off",
      }),
    ).toEqual({ barcode: null, hints: {}, fromOff: false });
    expect(parseFoodHints({ barcode: CODE, from: "usda" }).fromOff).toBe(false);
  });

  it("keeps a plain name from an empty search", () => {
    expect(parseFoodHints({ name: "творог" })).toEqual({
      barcode: null,
      hints: { name: "Творог" },
      fromOff: false,
    });
  });
});

describe("newFoodHref", () => {
  it("round-trips through parseFoodHints with the diary context", () => {
    const hints = {
      name: "Батончик & co",
      kcal100: 288.33,
      protein100: 33.33,
      fat100: 0,
      carbs100: 5.83,
    };
    const href = newFoodHref({
      barcode: CODE,
      hints,
      fromOff: true,
      entry: { date: "2026-10-22", meal: "breakfast" },
    });
    expect(href.startsWith("/foods/new?")).toBe(true);
    const params = Object.fromEntries(new URL(href, "https://x.test").searchParams);
    expect(params).toMatchObject({ date: "2026-10-22", meal: "breakfast" });
    expect(parseFoodHints(params)).toEqual({ barcode: CODE, hints, fromOff: true });
  });

  it("carries only the code when nothing else is known", () => {
    expect(newFoodHref({ barcode: CODE, hints: {}, fromOff: false })).toBe(
      `/foods/new?barcode=${CODE}`,
    );
  });
});
