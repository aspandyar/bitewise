import { z } from "zod";
import { DIARY_LIMITS, NUTRIENT_STORAGE_SCALE } from "@/lib/config";
import type { PortionValues } from "@/lib/foods/types";
import { decimalField, readDecimalInput } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { calcEntryNutrients, calcPortionGrams, type Per100g } from "@/lib/nutrition";

// Diary entries and recipe ingredients store the same amount: grams, or a portion snapshot × count.
// Kept free of DB imports so client components can use these types.
export type GramsAmount = { mode: "grams"; grams: number };

export type AddAmount = GramsAmount | { mode: "portion"; portionId: string; count: number };

// Editing keeps the portion snapshot: only its count changes, or the amount switches to grams.
// An amount saved in grams has no snapshot, so it may pick one of its food's portions instead.
export type UpdateAmount = GramsAmount | { mode: "portion"; count: number; portionId?: string };

// Inputs get the precision the columns store, so grams = count × portion grams holds once saved.
export const toStoragePrecision = (value: number) =>
  Math.round(value * NUTRIENT_STORAGE_SCALE) / NUTRIENT_STORAGE_SCALE;

const { grams, portionCount } = DIARY_LIMITS;
const gramsField = () =>
  decimalField(grams, ru.errors.gramsRange(grams.min, grams.max), ru.errors.enter.grams).transform(
    toStoragePrecision,
  );
const countField = () =>
  decimalField(
    portionCount,
    ru.errors.portionCount(portionCount.min, portionCount.max),
    ru.errors.enter.count,
  ).transform(toStoragePrecision);

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
  z.object({
    mode: z.literal("portion"),
    portionId: z.uuid({ error: ru.errors.choosePortion }).optional(),
    count: countField(),
  }),
]);

export type AddAmountForm = z.infer<typeof addAmountSchema>;
export type UpdateAmountForm = z.infer<typeof updateAmountSchema>;

export function toAddAmount(form: AddAmountForm): AddAmount {
  return form.mode === "grams"
    ? { mode: "grams", grams: form.grams }
    : { mode: "portion", portionId: form.portionId, count: form.count };
}

export function toUpdateAmount(form: UpdateAmountForm): UpdateAmount {
  if (form.mode === "grams") return { mode: "grams", grams: form.grams };
  return form.portionId === undefined
    ? { mode: "portion", count: form.count }
    : { mode: "portion", portionId: form.portionId, count: form.count };
}

// The heaviest portion times the largest count, or the lightest split in quarters, falls outside
// the range a grams amount allows; such an entry could never be edited back in grams.
export function isStorableGrams(value: number): boolean {
  return value >= grams.min && value <= grams.max;
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
  return portionColumns(portion, amount.count);
}

function portionColumns(portion: PortionValues, count: number): AmountColumns {
  return {
    grams: calcPortionGrams(portion.grams, count),
    portionLabel: portion.label,
    portionGrams: portion.grams,
    portionCount: count,
  };
}

// What an edit writes: grams drop the portion; a count multiplies the snapshot, or the portion just
// picked when there is none yet. Null means a count with no portion to count.
export function toUpdatedAmountColumns(
  amount: UpdateAmount,
  snapshotGrams: number | null,
  picked: PortionValues | null,
): (Partial<AmountColumns> & { grams: number }) | null {
  if (amount.mode === "grams") return { grams: amount.grams, ...NO_PORTION };
  if (snapshotGrams !== null) {
    return { grams: calcPortionGrams(snapshotGrams, amount.count), portionCount: amount.count };
  }
  return picked ? portionColumns(picked, amount.count) : null;
}

// The portion to look up for an edit: only when a grams amount switches to a picked portion.
export function portionToPick(amount: UpdateAmount, snapshotGrams: number | null): string | null {
  return amount.mode === "portion" && snapshotGrams === null ? (amount.portionId ?? null) : null;
}

export type AmountPreview =
  | { mode: "grams"; grams: string }
  | { mode: "portion"; portionGrams: number | null; count: string };

// The amount screen shows kcal while typing; null until the typed amount is a positive number.
export function previewKcal(per100g: Per100g, amount: AmountPreview): number | null {
  if (amount.mode === "grams") {
    const grams = readDecimalInput(amount.grams);
    return grams !== null && grams > 0 ? calcEntryNutrients(per100g, grams).kcal : null;
  }
  const count = readDecimalInput(amount.count);
  if (amount.portionGrams === null || count === null || count <= 0) return null;
  return calcEntryNutrients(per100g, calcPortionGrams(amount.portionGrams, count)).kcal;
}
