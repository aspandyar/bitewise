import { z } from "zod";
import { FOOD_LIMITS, PORTION_LIMITS } from "@/lib/config";
import { decimalField, optionalDecimalField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

const { nameLength, kcal100, nutrient100G, maxTotalGramsPer100G } = FOOD_LIMITS;
const gramsMessage = ru.errors.gramsRange(nutrient100G.min, nutrient100G.max);
const grams = () => decimalField(nutrient100G, gramsMessage);
const nameMessage = ru.errors.nameLength(nameLength.min, nameLength.max);

// Integer hundredths: 33.3 + 33.3 + 33.4 is 100.00000000000001 in floats.
const toHundredths = (value: number) => Math.round(value * 100);

// Shared with recipes, whose names live in foods too.
export const foodNameSchema = z
  .string()
  .trim()
  .min(nameLength.min, { error: nameMessage })
  .max(nameLength.max, { error: nameMessage });

export const foodSchema = z
  .object({
    name: foodNameSchema,
    kcal100: decimalField(kcal100, ru.errors.kcalRange(kcal100.min, kcal100.max)),
    protein100: grams(),
    fat100: grams(),
    carbs100: grams(),
    fiber100: optionalDecimalField(nutrient100G, gramsMessage),
  })
  .refine(
    (food) =>
      toHundredths(food.protein100) +
        toHundredths(food.fat100) +
        toHundredths(food.carbs100) +
        toHundredths(food.fiber100 ?? 0) <=
      toHundredths(maxTotalGramsPer100G),
    { error: ru.errors.macroSum(maxTotalGramsPer100G), path: ["carbs100"] },
  );

const { labelLength, grams: portionGrams } = PORTION_LIMITS;
const labelMessage = ru.errors.portionLabelLength(labelLength.min, labelLength.max);

export const portionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(labelLength.min, { error: labelMessage })
    .max(labelLength.max, { error: labelMessage }),
  grams: decimalField(portionGrams, ru.errors.portionGrams(portionGrams.min, portionGrams.max)),
});

export const foodIdSchema = z.uuid();

// Ids arrive from URLs and bound action arguments; Postgres would throw on a malformed uuid.
export function parseFoodId(value: unknown): string | null {
  const parsed = foodIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
