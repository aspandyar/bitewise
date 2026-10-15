import { z } from "zod";
import { DIARY_LIMITS, FOOD_LIMITS, QUICK } from "@/lib/config";
import { decimalField, optionalDecimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

// A "just kcal" entry: kcal are required, the rest is optional and means "not counted" (0).
export type QuickEntryValues = {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

const { nameLength } = FOOD_LIMITS;
const gramsRange = { min: 0, max: DIARY_LIMITS.grams.max };
const macro = () =>
  optionalDecimalField(gramsRange, ru.errors.gramsRange(gramsRange.min, gramsRange.max)).transform(
    (value) => value ?? 0,
  );

export const quickEntryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .max(nameLength.max, { error: ru.errors.nameLength(nameLength.min, nameLength.max) })
    .transform((name) => name || ru.diary.quickDefaultName),
  kcal: decimalField(
    QUICK.kcal,
    ru.errors.kcalRange(QUICK.kcal.min, QUICK.kcal.max),
    ru.errors.enter.kcal,
  ),
  proteinG: macro(),
  fatG: macro(),
  carbsG: macro(),
});
