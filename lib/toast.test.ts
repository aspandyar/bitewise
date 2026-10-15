import { describe, expect, it } from "vitest";
import { TOAST_PARAM, UNDO_PARAM } from "@/lib/config";
import { parseToast, withoutToast, withToast } from "./toast";

describe("withToast", () => {
  it("adds the toast to a path", () => {
    expect(withToast("/foods", "deleted")).toBe(`/foods?${TOAST_PARAM}=deleted`);
  });

  it("keeps an existing query", () => {
    expect(withToast("/foods/new?name=x", "saved")).toBe(`/foods/new?name=x&${TOAST_PARAM}=saved`);
  });
});

describe("withToast and undo", () => {
  const a = "6f1c1a0e-1111-4c1a-9a0e-000000000001";
  const b = "6f1c1a0e-1111-4c1a-9a0e-000000000002";

  it("carries the ids to undo", () => {
    expect(withToast("/", "added", [a])).toBe(`/?${TOAST_PARAM}=added&${UNDO_PARAM}=${a}`);
    expect(withToast("/?date=2026-10-14", "addedMany", [a, b])).toBe(
      `/?date=2026-10-14&${TOAST_PARAM}=addedMany&${UNDO_PARAM}=${a},${b}`,
    );
  });

  it("drops the undo ids together with the toast", () => {
    expect(
      withoutToast("/", new URLSearchParams(`date=x&${TOAST_PARAM}=added&${UNDO_PARAM}=${a}`)),
    ).toBe("/?date=x");
  });
});

describe("parseToast", () => {
  it.each([
    "saved",
    "deleted",
    "copied",
    "added",
    "addedMany",
    "alreadyFilled",
    "dayFull",
  ] as const)("reads %s", (toast) => {
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
