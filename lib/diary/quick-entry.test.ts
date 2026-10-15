import { describe, expect, it } from "vitest";
import { QUICK } from "@/lib/config";
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { quickEntryFormSchema } from "./quick-entry";

const base = { name: "", kcal: "450", proteinG: "", fatG: "", carbsG: "" };

describe("quickEntryFormSchema", () => {
  it("defaults the name and zeroes missing macros", () => {
    expect(quickEntryFormSchema.parse(base)).toEqual({
      name: ru.diary.quickDefaultName,
      kcal: 450,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
    });
  });

  it("reads a name and macros with a decimal comma", () => {
    expect(
      quickEntryFormSchema.parse({
        name: " Пирожок ",
        kcal: "312,5",
        proteinG: "8",
        fatG: "12,5",
        carbsG: "40",
      }),
    ).toEqual({ name: "Пирожок", kcal: 312.5, proteinG: 8, fatG: 12.5, carbsG: 40 });
  });

  it("asks to fill in kcal", () => {
    const parsed = quickEntryFormSchema.safeParse({ ...base, kcal: " " });
    expect(parsed.error && firstFieldErrors(parsed.error)).toEqual({ kcal: ru.errors.enter.kcal });
  });

  it.each([String(QUICK.kcal.min - 1), String(QUICK.kcal.max + 1), "abc"])(
    "rejects kcal %s",
    (kcal) => {
      expect(quickEntryFormSchema.safeParse({ ...base, kcal }).success).toBe(false);
    },
  );

  it("rejects negative macros", () => {
    expect(quickEntryFormSchema.safeParse({ ...base, fatG: "-1" }).success).toBe(false);
  });
});
