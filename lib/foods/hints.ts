import { z } from "zod";
import { FOOD_LIMITS, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { diarySearch } from "@/lib/diary/paths";
import { normalizeBarcode } from "./barcode";
import { parseDraftName } from "./schema";

// What a scan can still offer the own-food form when the product is not usable as it is; it
// travels in the form's URL. Lives here, not in the server-only off.ts, for the client.
export type FoodHints = {
  name?: string;
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  fiber100?: number;
};

type Params = Record<string, string | string[] | undefined>;

export const OFF_MARK = "off";
const NUMBER = /^\d+(\.\d+)?$/;

const numberHint = (limits: { min: number; max: number }) =>
  z
    .string()
    .regex(NUMBER)
    .transform(Number)
    .pipe(z.number().min(limits.min).max(limits.max))
    .optional()
    .catch(undefined);

const numberHints = {
  kcal100: numberHint(FOOD_LIMITS.kcal100),
  protein100: numberHint(FOOD_LIMITS.nutrient100G),
  fat100: numberHint(FOOD_LIMITS.nutrient100G),
  carbs100: numberHint(FOOD_LIMITS.nutrient100G),
  fiber100: numberHint(FOOD_LIMITS.nutrient100G),
};

// A scan that found nothing usable opens the own-food form with what it knows. The URL is
// user-editable, so every value only prefills a field and anything odd is dropped; the form
// validates again on save.
export function parseFoodHints(params: Params): {
  barcode: string | null;
  hints: FoodHints;
  fromOff: boolean;
} {
  const barcode = typeof params.barcode === "string" ? normalizeBarcode(params.barcode) : null;
  const hints: FoodHints = {};
  const name = parseDraftName(params.name);
  if (name !== undefined) hints.name = name;
  for (const key of Object.keys(numberHints) as (keyof typeof numberHints)[]) {
    const value = numberHints[key].parse(params[key]);
    if (value !== undefined) hints[key] = value;
  }
  // The mark only credits Open Food Facts on the user's own food, and only for a scanned code.
  return { barcode, hints, fromOff: barcode !== null && params.from === OFF_MARK };
}

export function newFoodHref(input: {
  barcode: string;
  hints: FoodHints;
  fromOff: boolean;
  entry?: { date: IsoDate; meal: Meal };
}): string {
  const params = new URLSearchParams(input.entry ? diarySearch(input.entry.date, input.entry.meal) : "");
  params.set("barcode", input.barcode);
  for (const [key, value] of Object.entries(input.hints)) {
    if (value !== undefined) params.set(key, String(value));
  }
  if (input.fromOff) params.set("from", OFF_MARK);
  return `/foods/new?${params}`;
}

