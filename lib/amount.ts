import { z } from "zod";
import { DIARY_LIMITS, NUTRIENT_STORAGE_DECIMALS } from "@/lib/config";
import type { PortionValues } from "@/lib/foods/types";
import { decimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { calcPortionGrams } from "@/lib/nutrition";

// Diary entries and recipe ingredients store the same amount: grams, or a portion snapshot × count.
// Kept free of DB imports so client components can use these types.
export type GramsAmount = { mode: "grams"; grams: number };

export type AddAmount = GramsAmount | { mode: "portion"; portionId: string; count: number };

// Editing keeps the portion snapshot: only its count changes, or the amount switches to grams.
export type UpdateAmount = GramsAmount | { mode: "portion"; count: number };

const STORAGE_SCALE = 10 ** NUTRIENT_STORAGE_DECIMALS;
// Inputs get the precision the columns store, so grams = count × portion grams holds once saved.
export const toStoragePrecision = (value: number) =>
  Math.round(value * STORAGE_SCALE) / STORAGE_SCALE;

const { grams, portionCount } = DIARY_LIMITS;
const gramsField = () =>
  decimalField(grams, ru.errors.gramsRange(grams.min, grams.max)).transform(toStoragePrecision);
const countField = () =>
  decimalField(portionCount, ru.errors.portionCount(portionCount.min, portionCount.max)).transform(
    toStoragePrecision,
  );

const gramsAmountSchema = z.object({ mode: z.literal("grams"), grams: gramsField() });

export const addAmountSchema = z.discriminatedUnion("mode", [
  gramsAmountSchema,
  z.object({
    mode: z.literal("portion"),
    portionId: z.uuid({ error: ru.errors.choosePortion }),
    count: countField(),
  }),
]);

export const updateAmountSchema = z.discriminatedUnion("mode", [
  gramsAmountSchema,
  z.object({ mode: z.literal("portion"), count: countField() }),
]);

export type AddAmountForm = z.infer<typeof addAmountSchema>;
export type UpdateAmountForm = z.infer<typeof updateAmountSchema>;

export function toAddAmount(form: AddAmountForm): AddAmount {
  return form.mode === "grams"
    ? { mode: "grams", grams: form.grams }
    : { mode: "portion", portionId: form.portionId, count: form.count };
}

export function toUpdateAmount(form: UpdateAmountForm): UpdateAmount {
  return form.mode === "grams"
    ? { mode: "grams", grams: form.grams }
    : { mode: "portion", count: form.count };
}

export type AmountColumns = {
  grams: number;
  portionLabel: string | null;
  portionGrams: number | null;
  portionCount: number | null;
};

export const NO_PORTION = { portionLabel: null, portionGrams: null, portionCount: null } as const;

export function toAmountColumns(amount: AddAmount, portion: PortionValues | null): AmountColumns {
  if (amount.mode === "grams") return { grams: amount.grams, ...NO_PORTION };
  // Callers look the portion up first and answer "not found" when it is missing.
  if (!portion) throw new Error("portion amount without a portion");
  return {
    grams: calcPortionGrams(portion.grams, amount.count),
    portionLabel: portion.label,
    portionGrams: portion.grams,
    portionCount: amount.count,
  };
}
