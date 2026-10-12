import { z } from "zod";
import { toStoragePrecision } from "@/lib/amount";
import { RECIPE_LIMITS } from "@/lib/config";
import { foodNameSchema } from "@/lib/foods/schema";
import { optionalDecimalField, optionalIntegerField } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

const { cookedWeightG, servings } = RECIPE_LIMITS;

export const recipeFormSchema = z.object({
  name: foodNameSchema,
  cookedWeightG: optionalDecimalField(
    cookedWeightG,
    ru.errors.cookedWeight(cookedWeightG.min, cookedWeightG.max),
  ).transform((value) => (value === null ? null : toStoragePrecision(value))),
  servings: optionalIntegerField(servings, ru.errors.servings(servings.min, servings.max)),
});
