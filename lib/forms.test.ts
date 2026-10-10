import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decimalField, firstFieldErrors, optionalDecimalField } from "./forms";

describe("decimalField", () => {
  const field = decimalField({ min: 30, max: 300 }, "bad");

  it("accepts a decimal comma from a Russian keyboard", () => {
    expect(field.parse("80,5")).toBe(80.5);
  });

  it("accepts a dot and surrounding spaces", () => {
    expect(field.parse(" 80.5 ")).toBe(80.5);
  });

  it.each(["", "  ", "abc", "29.9", "300.1"])("rejects %j", (value) => {
    expect(field.safeParse(value).success).toBe(false);
  });

  it("accepts the limits themselves", () => {
    expect(field.parse("30")).toBe(30);
    expect(field.parse("300")).toBe(300);
  });
});

describe("firstFieldErrors", () => {
  it("keeps only the first message per field", () => {
    const schema = z.object({ a: z.string().min(2, "short").email("email"), b: z.string() });
    const result = schema.safeParse({ a: "x", b: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = firstFieldErrors(result.error);
    expect(errors.a).toBe("short");
    expect(errors.b).toEqual(expect.any(String));
  });
});

describe("optionalDecimalField", () => {
  const field = optionalDecimalField({ min: 0, max: 100 }, "bad");

  it("turns an empty or blank field into null", () => {
    expect(field.parse("")).toBeNull();
    expect(field.parse("  ")).toBeNull();
  });

  it("keeps an explicit zero", () => {
    expect(field.parse("0")).toBe(0);
  });

  it("accepts a decimal comma", () => {
    expect(field.parse("2,5")).toBe(2.5);
  });

  it("rejects out-of-range and non-numeric input", () => {
    expect(field.safeParse("101").success).toBe(false);
    expect(field.safeParse("abc").success).toBe(false);
  });
});
