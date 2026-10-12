import { z } from "zod";
import { DIARY_LIMITS, MEALS, NUTRIENT_STORAGE_DECIMALS, type Meal } from "@/lib/config";
import { parseIsoDate, type IsoDate } from "@/lib/date";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { AddAmount, UpdateAmount } from "./types";

const STORAGE_SCALE = 10 ** NUTRIENT_STORAGE_DECIMALS;
// Inputs get the precision the columns store, so grams = count × portion grams holds once saved.
const toStoragePrecision = (value: number) => Math.round(value * STORAGE_SCALE) / STORAGE_SCALE;

const { grams, portionCount } = DIARY_LIMITS;
const gramsField = () =>
  decimalField(grams, ru.errors.gramsRange(grams.min, grams.max)).transform(toStoragePrecision);
const countField = () =>
  decimalField(portionCount, ru.errors.portionCount(portionCount.min, portionCount.max)).transform(
    toStoragePrecision,
  );

export const mealSchema = z.enum(MEALS, { error: ru.errors.choose });

const gramsAmountSchema = z.object({ mode: z.literal("grams"), grams: gramsField() });

// Forms post flat fields; the intersection keeps every error on its own field name.
export const addEntryFormSchema = z.object({ meal: mealSchema }).and(
  z.discriminatedUnion("mode", [
    gramsAmountSchema,
    z.object({
      mode: z.literal("portion"),
      portionId: z.uuid({ error: ru.errors.choosePortion }),
      count: countField(),
    }),
  ]),
);

export const updateEntryFormSchema = z
  .object({ meal: mealSchema })
  .and(
    z.discriminatedUnion("mode", [
      gramsAmountSchema,
      z.object({ mode: z.literal("portion"), count: countField() }),
    ]),
  );

export type AddEntryForm = z.infer<typeof addEntryFormSchema>;
export type UpdateEntryForm = z.infer<typeof updateEntryFormSchema>;

export function toAddAmount(form: AddEntryForm): AddAmount {
  return form.mode === "grams"
    ? { mode: "grams", grams: form.grams }
    : { mode: "portion", portionId: form.portionId, count: form.count };
}

export function toUpdateAmount(form: UpdateEntryForm): UpdateAmount {
  return form.mode === "grams"
    ? { mode: "grams", grams: form.grams }
    : { mode: "portion", count: form.count };
}

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

const idSchema = z.uuid();

// Postgres throws on a malformed uuid, so ids from URLs and bound arguments are checked first.
export function parseId(value: unknown): string | null {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
