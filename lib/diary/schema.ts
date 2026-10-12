import { z } from "zod";
import { addAmountSchema, updateAmountSchema } from "@/lib/amount";
import { DIARY_LIMITS, MEALS, type Meal } from "@/lib/config";
import { parseIsoDate, type IsoDate } from "@/lib/date";
import { ru } from "@/lib/i18n/ru";

export { toAddAmount, toUpdateAmount } from "@/lib/amount";
export { parseId } from "@/lib/ids";

export const mealSchema = z.enum(MEALS, { error: ru.errors.choose });

// Forms post flat fields; the intersection keeps every error on its own field name.
export const addEntryFormSchema = z.object({ meal: mealSchema }).and(addAmountSchema);
export const updateEntryFormSchema = z.object({ meal: mealSchema }).and(updateAmountSchema);

export type AddEntryForm = z.infer<typeof addEntryFormSchema>;
export type UpdateEntryForm = z.infer<typeof updateEntryFormSchema>;

const isoDateSchema = z.string().refine((value) => parseIsoDate(value) !== null);

// Dates arrive from URLs and hidden fields; the future is not a diary day.
export function parseDiaryDate(value: unknown, today: IsoDate): IsoDate | null {
  const parsed = isoDateSchema
    // ISO dates compare correctly as plain strings.
    .refine((date) => date >= DIARY_LIMITS.minDate && date <= today)
    .safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseMeal(value: unknown): Meal | null {
  const parsed = mealSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
