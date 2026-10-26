import { z } from "zod";
import { FOOD_LIMITS, NUTRIENT_STORAGE_SCALE, PORTION_LIMITS } from "@/lib/config";
import { decimalField, optionalDecimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { normalizeBarcode } from "./barcode";

const { nameLength, kcal100, nutrient100G, maxTotalGramsPer100G } = FOOD_LIMITS;
const gramsMessage = ru.errors.gramsRange(nutrient100G.min, nutrient100G.max);
const grams = () => decimalField(nutrient100G, gramsMessage, ru.errors.enter.grams);
const nameMessage = ru.errors.nameLength(nameLength.min, nameLength.max);

// Integer storage units (hundredths): 33.3 + 33.3 + 33.4 is 100.00000000000001 in floats.
const toHundredths = (value: number) => Math.round(value * NUTRIENT_STORAGE_SCALE);

// Shared with recipes, whose names live in foods too.
export const foodNameSchema = z
  .string()
  .trim()
  .nonempty({ error: ru.errors.enter.name })
  .min(nameLength.min, { error: nameMessage })
  .max(nameLength.max, { error: nameMessage });

const foodFields = {
  name: foodNameSchema,
  kcal100: decimalField(
    kcal100,
    ru.errors.kcalRange(kcal100.min, kcal100.max),
    ru.errors.enter.kcal,
  ),
  protein100: grams(),
  fat100: grams(),
  carbs100: grams(),
  fiber100: optionalDecimalField(nutrient100G, gramsMessage),
};

function macrosFit(food: {
  protein100: number;
  fat100: number;
  carbs100: number;
  fiber100: number | null;
}) {
  return (
    toHundredths(food.protein100) +
      toHundredths(food.fat100) +
      toHundredths(food.carbs100) +
      toHundredths(food.fiber100 ?? 0) <=
    toHundredths(maxTotalGramsPer100G)
  );
}
const macroSumError = { error: ru.errors.macroSum(maxTotalGramsPer100G), path: ["carbs100"] };

export const foodSchema = z.object(foodFields).refine(macrosFit, macroSumError);

// Empty means none; a typed UPC-A is stored as EAN-13 like a scanned one, so both find the food.
const barcodeField = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim() ?? "";
    if (trimmed === "") return null;
    const code = normalizeBarcode(trimmed);
    if (!code) ctx.addIssue({ code: "custom", message: ru.errors.barcode });
    return code;
  });

// The own-food form: the same numbers as any food, plus the pack's barcode.
export const ownFoodSchema = z
  .object({ ...foodFields, barcode: barcodeField })
  .refine(macrosFit, macroSumError);

const { labelLength, grams: portionGrams } = PORTION_LIMITS;
const labelMessage = ru.errors.portionLabelLength(labelLength.min, labelLength.max);

export const portionSchema = z.object({
  label: z
    .string()
    .trim()
    .nonempty({ error: ru.errors.enter.portionLabel })
    .min(labelLength.min, { error: labelMessage })
    .max(labelLength.max, { error: labelMessage }),
  grams: decimalField(
    portionGrams,
    ru.errors.portionGrams(portionGrams.min, portionGrams.max),
    ru.errors.enter.grams,
  ),
});

export const foodIdSchema = z.uuid();

// Ids arrive from URLs and bound action arguments; Postgres would throw on a malformed uuid.
export function parseFoodId(value: unknown): string | null {
  const parsed = foodIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const draftNameSchema = z.string().trim().min(nameLength.min).max(nameLength.max);

// "Add your own" from an empty search carries the query in the URL; it only prefills the form, so
// anything odd is dropped rather than reported. Search text is lower-case; names start capitalized.
export function parseDraftName(value: unknown): string | undefined {
  const parsed = draftNameSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data.charAt(0).toLocaleUpperCase(ru.locale) + parsed.data.slice(1);
}
