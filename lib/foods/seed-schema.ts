import { z } from "zod";
import { FOOD_LIMITS, PORTION_LIMITS } from "@/lib/config";

const { nameLength, kcal100, nutrient100G } = FOOD_LIMITS;
const grams100 = z.number().min(nutrient100G.min).max(nutrient100G.max);

const portion = z.object({
  label: z.string().trim().min(PORTION_LIMITS.labelLength.min).max(PORTION_LIMITS.labelLength.max),
  grams: z.number().min(PORTION_LIMITS.grams.min).max(PORTION_LIMITS.grams.max),
});
const name = z.string().trim().min(nameLength.min).max(nameLength.max);
const values = {
  kcal100: z.number().min(kcal100.min).max(kcal100.max),
  protein100: grams100,
  fat100: grams100,
  carbs100: grams100,
  fiber100: grams100.nullable(),
};
const httpsUrl = z.url({ protocol: /^https$/ });

export const usdaSourceSchema = z.array(
  z.object({ fdcId: z.number().int().positive(), name, portions: z.array(portion) }),
);
export type UsdaSource = z.infer<typeof usdaSourceSchema>[number];

export const labelSourceSchema = z.array(
  z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name,
    ...values,
    sourceUrl: httpsUrl,
    portions: z.array(portion),
  }),
);
export type LabelSource = z.infer<typeof labelSourceSchema>[number];

const seedFood = z
  .object({
    key: z.string(),
    name,
    source: z.enum(["usda", "label"]),
    ...values,
    sourceUrl: httpsUrl.nullable(),
    portions: z.array(portion),
  })
  // The key prefix is what loadFoodSeed and reviewers rely on to trace a row back to its source.
  .refine((food) => food.key.startsWith(`${food.source}:`), { error: "key must match source" })
  .refine((food) => (food.source === "label") === (food.sourceUrl !== null), {
    error: "label foods need a source url, usda foods have none",
  })
  // loadFoodSeed syncs shared portions by label, so a label must identify one portion.
  .refine((food) => new Set(food.portions.map((p) => p.label)).size === food.portions.length, {
    error: "duplicate portion labels",
  });
export type SeedFood = z.infer<typeof seedFood>;

export const seedFileSchema = z
  .array(seedFood)
  .refine((foods) => new Set(foods.map((food) => food.key)).size === foods.length, {
    error: "duplicate seed keys",
  });
