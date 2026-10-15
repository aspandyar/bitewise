import { describe, expect, it } from "vitest";
import { TOAST_PARAM } from "@/lib/config";
import { parseToast, withoutToast, withToast } from "./toast";

describe("withToast", () => {
  it("adds the toast to a path", () => {
    expect(withToast("/foods", "deleted")).toBe(`/foods?${TOAST_PARAM}=deleted`);
  });

  it("keeps an existing query", () => {
    expect(withToast("/foods/new?name=x", "saved")).toBe(`/foods/new?name=x&${TOAST_PARAM}=saved`);
  });
});

describe("parseToast", () => {
  it.each(["saved", "deleted", "copied"] as const)("reads %s", (toast) => {
    expect(parseToast(toast)).toBe(toast);
  });

  it.each([null, "", "hacked", "<b>"])("ignores %j", (value) => {
    expect(parseToast(value)).toBeNull();
  });
});

describe("withoutToast", () => {
  it("drops only the toast from the query", () => {
    expect(withoutToast("/foods/1", new URLSearchParams(`a=1&${TOAST_PARAM}=saved`))).toBe(
      "/foods/1?a=1",
    );
  });

  it("leaves a bare path when nothing else remains", () => {
    expect(withoutToast("/foods", new URLSearchParams(`${TOAST_PARAM}=deleted`))).toBe("/foods");
  });
});
