import { describe, expect, it, vi } from "vitest";
import { FOOD_LIMITS, OFF } from "@/lib/config";
import bombbar from "@/tests/fixtures/off/found-bombbar.json";
import kjOnly from "@/tests/fixtures/off/kj-only-edited.json";
import noProtein from "@/tests/fixtures/off/no-protein-edited.json";
import noServing from "@/tests/fixtures/off/found-no-serving.json";
import notFound from "@/tests/fixtures/off/not-found.json";
import servingOnly from "@/tests/fixtures/off/serving-only-edited.json";
import servingOnlyNoWeight from "@/tests/fixtures/off/serving-only-no-weight-edited.json";
import smartbar from "@/tests/fixtures/off/found-smartbar-entities.json";
import { fetchOffProduct, parseOffProduct } from "./off";

const BOMBBAR = "4610169567113";

// A fixture with a few product fields replaced, for the cases no real product shows.
function withProduct(fields: Record<string, unknown>, nutriments: Record<string, unknown> = {}) {
  const json = structuredClone(bombbar);
  Object.assign(json.product, fields);
  Object.assign(json.product.nutriments, nutriments);
  return json;
}

const noOtherEnergy = {
  "energy-kcal_serving": undefined,
  "energy-kj_100g": undefined,
  "energy-kj_serving": undefined,
  energy_100g: undefined,
  energy_serving: undefined,
};

describe("parseOffProduct", () => {
  it("takes the per-100 g numbers, the serving as a portion and links the product page", () => {
    expect(parseOffProduct(bombbar, BOMBBAR)).toEqual({
      kind: "found",
      values: {
        name: "Батончик неглазированный со вкусом «Малиновый чизкейк» (Bombbar)",
        kcal100: 288.333333333333,
        protein100: 33.3333333333333,
        fat100: 7.16666666666667,
        carbs100: 5.83333333333333,
        fiber100: 33.3333333333333,
      },
      portionGrams: 60,
      sourceUrl: "https://world.openfoodfacts.org/product/4610169567113",
    });
  });

  it("decodes HTML entities in the name and leaves fiber empty when the label has none", () => {
    const product = parseOffProduct(smartbar, "4630017461233");
    expect(product).toMatchObject({
      kind: "found",
      values: {
        name: 'Протеиновый батончик "банан в темной глазури" (Smartbar)',
        kcal100: 425,
        fiber100: null,
      },
      portionGrams: 40,
    });
  });

  it("has no portion without a serving weight, or with one outside the portion limits", () => {
    expect(parseOffProduct(noServing, "4631162064096")).toMatchObject({
      kind: "found",
      portionGrams: null,
    });
    expect(parseOffProduct(withProduct({ serving_quantity: 0 }), BOMBBAR)).toMatchObject({
      portionGrams: null,
    });
    expect(parseOffProduct(withProduct({ serving_quantity: 9000 }), BOMBBAR)).toMatchObject({
      portionGrams: null,
    });
    expect(parseOffProduct(withProduct({ serving_quantity: "50" }), BOMBBAR)).toMatchObject({
      portionGrams: 50,
    });
  });

  it("converts kilojoules to kcal when only energy in kJ is given", () => {
    const product = parseOffProduct(kjOnly, "4631162064096");
    if (product.kind !== "found") throw new Error(`expected found, got ${product.kind}`);
    // 1937.32 kJ / 4.184 = 463.03 kcal
    expect(product.values.kcal100).toBeCloseTo(463.03, 2);
  });

  it("scales per-serving numbers to 100 g by the serving weight", () => {
    const product = parseOffProduct(servingOnly, BOMBBAR);
    if (product.kind !== "found") throw new Error(`expected found, got ${product.kind}`);
    // 173 kcal, 20 g protein, 4.3 g fat, 3.5 g carbs, 20 g fiber in a 60 g bar
    expect(product.values.kcal100).toBeCloseTo(288.33, 2);
    expect(product.values.protein100).toBeCloseTo(33.33, 2);
    expect(product.values.fat100).toBeCloseTo(7.17, 2);
    expect(product.values.carbs100).toBeCloseTo(5.83, 2);
    expect(product.values.fiber100).toBeCloseTo(33.33, 2);
  });

  it("does not scale per-serving numbers by a serving weight outside the portion limits", () => {
    const product = parseOffProduct(
      { ...servingOnly, product: { ...servingOnly.product, serving_quantity: 9000 } },
      BOMBBAR,
    );
    expect(product.kind).toBe("incomplete");
  });

  it("treats per-serving numbers without a serving weight as incomplete", () => {
    expect(parseOffProduct(servingOnlyNoWeight, BOMBBAR)).toEqual({
      kind: "incomplete",
      hints: { name: "Батончик неглазированный со вкусом «Малиновый чизкейк» (Bombbar)" },
    });
  });

  it("treats a missing macro as incomplete and keeps what is known as hints", () => {
    expect(parseOffProduct(noProtein, "4630017461233")).toEqual({
      kind: "incomplete",
      hints: {
        name: 'Протеиновый батончик "банан в темной глазури" (Smartbar)',
        kcal100: 425,
        fat100: 15,
        carbs100: 50,
      },
    });
  });

  it("treats numbers outside the food limits, negative or non-numeric as incomplete", () => {
    for (const kcal of [9000, -5, "abc", "", null]) {
      // Only the kcal field is left as an energy source, so no fallback can stand in for it.
      const product = parseOffProduct(
        withProduct({}, { ...noOtherEnergy, "energy-kcal_100g": kcal }),
        BOMBBAR,
      );
      expect(product.kind).toBe("incomplete");
      if (product.kind === "incomplete") expect(product.hints.kcal100).toBeUndefined();
    }
    expect(parseOffProduct(withProduct({}, { proteins_100g: -1 }), BOMBBAR).kind).toBe(
      "incomplete",
    );
    expect(parseOffProduct(withProduct({}, { fat_100g: 101 }), BOMBBAR).kind).toBe("incomplete");
  });

  it("falls back to kcal per serving when kcal per 100 g is unreadable", () => {
    const product = parseOffProduct(withProduct({}, { "energy-kcal_100g": "n/a" }), BOMBBAR);
    if (product.kind !== "found") throw new Error(`expected found, got ${product.kind}`);
    // 173 kcal in a 60 g bar
    expect(product.values.kcal100).toBeCloseTo(288.33, 2);
  });

  it("accepts numbers sent as numeric strings", () => {
    const product = parseOffProduct(withProduct({}, { "energy-kcal_100g": "288.5" }), BOMBBAR);
    expect(product).toMatchObject({ kind: "found", values: { kcal100: 288.5 } });
  });

  it("treats macros adding up to more than 100 g as incomplete", () => {
    const product = parseOffProduct(withProduct({}, { carbohydrates_100g: 60 }), BOMBBAR);
    expect(product.kind).toBe("incomplete");
  });

  it("picks the Russian name, then the main one, then the generic names", () => {
    const named = (fields: Record<string, unknown>) => {
      const product = parseOffProduct(withProduct({ brands: "", ...fields }), BOMBBAR);
      return product.kind === "found" ? product.values.name : product.kind;
    };
    expect(named({ product_name_ru: "Батончик", product_name: "Bar" })).toBe("Батончик");
    expect(named({ product_name_ru: "  ", product_name: "Bar" })).toBe("Bar");
    expect(named({ product_name_ru: "", product_name: "", generic_name_ru: "Вафли" })).toBe(
      "Вафли",
    );
    expect(named({ product_name_ru: "", product_name: "", generic_name: "Wafers" })).toBe("Wafers");
  });

  it("adds the first brand unless the name already has it", () => {
    const named = (fields: Record<string, unknown>) => {
      const product = parseOffProduct(withProduct(fields), BOMBBAR);
      return product.kind === "found" ? product.values.name : product.kind;
    };
    expect(named({ product_name_ru: "Батончик", brands: "Bombbar, Чикалаб" })).toBe(
      "Батончик (Bombbar)",
    );
    expect(named({ product_name_ru: "Батончик BOMBBAR", brands: "Bombbar" })).toBe(
      "Батончик BOMBBAR",
    );
  });

  it("cuts a long name to the name limit", () => {
    const product = parseOffProduct(withProduct({ product_name_ru: "Б".repeat(150) }), BOMBBAR);
    if (product.kind !== "found") throw new Error(`expected found, got ${product.kind}`);
    expect(product.values.name).toHaveLength(FOOD_LIMITS.nameLength.max);
  });

  it("treats a product with no name as incomplete", () => {
    const product = parseOffProduct(
      withProduct({ product_name_ru: "", product_name: "", brands: "Bombbar" }),
      BOMBBAR,
    );
    expect(product).toMatchObject({ kind: "incomplete", hints: { kcal100: 288.333333333333 } });
    if (product.kind === "incomplete") expect(product.hints.name).toBeUndefined();
  });

  it("reports an unknown product and a body that is not a product as not found", () => {
    expect(parseOffProduct(notFound, "4607001771456")).toEqual({ kind: "not_found" });
    expect(parseOffProduct("<html>", BOMBBAR)).toEqual({ kind: "not_found" });
    expect(parseOffProduct({ status: 1 }, BOMBBAR)).toEqual({ kind: "not_found" });
    expect(parseOffProduct(null, BOMBBAR)).toEqual({ kind: "not_found" });
  });
});

describe("fetchOffProduct", () => {
  const userAgent = "Bitewise/test (https://example.com)";
  const respond = (body: string, status = 200) =>
    vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));

  it("asks for the code with our User-Agent and only the fields we read", async () => {
    const fetchMock = respond(JSON.stringify(bombbar));
    const product = await fetchOffProduct(BOMBBAR, {
      fetch: fetchMock,
      timeoutMs: 1000,
      userAgent,
    });

    expect(product.kind).toBe("found");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${OFF.productUrl}${BOMBBAR}?fields=${OFF.fields.join(",")}`);
    expect(new Headers(init?.headers).get("User-Agent")).toBe(userAgent);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // A redirect would mean their API moved or something sits in between; neither is followed.
    expect(init?.redirect).toBe("error");
  });

  it("reports a 404 with status 0 as not found", async () => {
    const product = await fetchOffProduct("4607001771456", {
      fetch: respond(JSON.stringify(notFound), 404),
      timeoutMs: 1000,
      userAgent,
    });
    expect(product).toEqual({ kind: "not_found" });
  });

  it("reports throttling, outages, odd bodies, network errors and timeouts as unavailable", async () => {
    const deps = (fetchMock: typeof fetch) => ({ fetch: fetchMock, timeoutMs: 1000, userAgent });
    for (const fetchMock of [
      respond("Too many requests", 429),
      respond("Service unavailable", 503),
      respond("<html>maintenance</html>"),
      respond("<html>not found</html>", 404),
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")),
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    ]) {
      expect(await fetchOffProduct(BOMBBAR, deps(fetchMock))).toEqual({ kind: "unavailable" });
    }
  });
});
