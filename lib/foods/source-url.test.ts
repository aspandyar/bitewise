import { describe, expect, it } from "vitest";
import { copySourceUrl, safeSourceUrl } from "./source-url";

describe("safeSourceUrl", () => {
  it("keeps an https link", () => {
    expect(safeSourceUrl("https://vkusvill.ru/goods/1.html")).toBe(
      "https://vkusvill.ru/goods/1.html",
    );
  });

  it("keeps an Open Food Facts product link", () => {
    const url = "https://world.openfoodfacts.org/product/4610169567113";
    expect(safeSourceUrl(url)).toBe(url);
  });

  it.each(["javascript:alert(1)", "http://example.com", "data:text/html,x", "not a url", ""])(
    "drops %j",
    (url) => {
      expect(safeSourceUrl(url)).toBeNull();
    },
  );

  it("drops a missing link", () => {
    expect(safeSourceUrl(null)).toBeNull();
  });
});

describe("copySourceUrl", () => {
  it("links a copy of an Open Food Facts product to that product, else to the site", () => {
    expect(copySourceUrl("off", "4610169567113")).toBe(
      "https://world.openfoodfacts.org/product/4610169567113",
    );
    expect(copySourceUrl("off", null)).toBe("https://world.openfoodfacts.org/");
  });

  it("links a USDA copy to FoodData Central and leaves other sources as text", () => {
    expect(copySourceUrl("usda", null)).toBe("https://fdc.nal.usda.gov/");
    expect(copySourceUrl("label", null)).toBeNull();
    expect(copySourceUrl("user", null)).toBeNull();
  });
});
