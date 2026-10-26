import { describe, expect, it } from "vitest";
import { PROFILE_LIMITS } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { weightFormSchema } from "./schema";

const { min, max } = PROFILE_LIMITS.weightKg;

describe("weightFormSchema", () => {
  it("reads a decimal comma and the range edges", () => {
    expect(weightFormSchema.parse({ weightKg: "78,4" })).toEqual({ weightKg: 78.4 });
    expect(weightFormSchema.parse({ weightKg: String(min) })).toEqual({ weightKg: min });
    expect(weightFormSchema.parse({ weightKg: String(max) })).toEqual({ weightKg: max });
  });

  it("asks for a weight when the field is empty", () => {
    const parsed = weightFormSchema.safeParse({ weightKg: " " });
    expect(parsed.error?.issues[0]?.message).toBe(ru.errors.enter.weight);
  });

  it("refuses a weight outside the profile range", () => {
    for (const value of [String(min - 0.1), String(max + 0.1)]) {
      const parsed = weightFormSchema.safeParse({ weightKg: value });
      expect(parsed.error?.issues[0]?.message).toBe(ru.errors.weightRange(min, max));
    }
  });

  it("asks for a number when letters are typed", () => {
    const parsed = weightFormSchema.safeParse({ weightKg: "abc" });
    expect(parsed.error?.issues[0]?.message).toBe(ru.common.notANumber);
  });
});
