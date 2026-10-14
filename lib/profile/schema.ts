import { z } from "zod";
import { ACTIVITY_LEVELS, GOALS, PROFILE_LIMITS, SEXES } from "@/lib/config";
import { parseIsoDate, type IsoDate } from "@/lib/date";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { calcAgeYears } from "@/lib/nutrition";

const { heightCm, weightKg, ageYears } = PROFILE_LIMITS;

// "today" is an argument so the schema stays deterministic in tests.
export function makeProfileSchema(today: IsoDate) {
  return z.object({
    sex: z.enum(SEXES, { error: ru.errors.choose }),
    birthDate: z.string({ error: ru.errors.date }).superRefine((value, ctx) => {
      if (!parseIsoDate(value)) {
        ctx.addIssue({ code: "custom", message: ru.errors.date });
        return;
      }
      const age = calcAgeYears(value, today);
      if (age < ageYears.min || age > ageYears.max) {
        ctx.addIssue({ code: "custom", message: ru.errors.ageRange(ageYears.min, ageYears.max) });
      }
    }),
    heightCm: decimalField(
      heightCm,
      ru.errors.heightRange(heightCm.min, heightCm.max),
      ru.errors.enter.height,
    ),
    weightKg: decimalField(
      weightKg,
      ru.errors.weightRange(weightKg.min, weightKg.max),
      ru.errors.enter.weight,
    ),
    activityLevel: z.enum(ACTIVITY_LEVELS, { error: ru.errors.choose }),
    goal: z.enum(GOALS, { error: ru.errors.choose }),
  });
}
