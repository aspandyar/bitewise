import { describe, expect, it } from "vitest";
import { safeSourceUrl } from "./source-url";

describe("safeSourceUrl", () => {
  it("keeps an https link", () => {
    expect(safeSourceUrl("https://vkusvill.ru/goods/1.html")).toBe(
      "https://vkusvill.ru/goods/1.html",
    );
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
