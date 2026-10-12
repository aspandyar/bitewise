import { eq, inArray, sql } from "drizzle-orm";
import { foodPortions, foods, recipeItems, recipes } from "@/db/schema";
import type { Db } from "@/db/types";
import { PORTION_LIMITS } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { calcRecipe, calcServingGrams, type RecipeItemValues } from "@/lib/nutrition";

export const per100gColumns = {
  kcal100: foods.kcal100,
  protein100: foods.protein100,
  fat100: foods.fat100,
  carbs100: foods.carbs100,
};

// Deleted foods are read too: an ingredient deleted later keeps counting with its numbers.
export async function loadRecipeItemValues(
  db: Db,
  recipeId: string,
): Promise<(RecipeItemValues & { id: string })[]> {
  return db
    .select({ id: recipeItems.id, grams: recipeItems.grams, per100g: per100gColumns })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(eq(recipeItems.recipeId, recipeId));
}

type ServingTarget = { foodId: string; userId: string; servings: number | null };

// addPortion refuses recipe foods, so the only portion a recipe food has is its serving.
async function syncServingPortion(db: Db, recipe: ServingTarget, weightG: number): Promise<void> {
  const grams = recipe.servings === null ? null : calcServingGrams(weightG, recipe.servings);
  const [current] = await db
    .select({ id: foodPortions.id })
    .from(foodPortions)
    .where(eq(foodPortions.foodId, recipe.foodId))
    .limit(1);
  // A serving below the smallest portion would round to 0 g in numeric(8,2).
  if (grams === null || grams < PORTION_LIMITS.grams.min) {
    if (current) await db.delete(foodPortions).where(eq(foodPortions.foodId, recipe.foodId));
    return;
  }
  if (current) {
    await db.update(foodPortions).set({ grams }).where(eq(foodPortions.id, current.id));
  } else {
    await db.insert(foodPortions).values({
      foodId: recipe.foodId,
      userId: recipe.userId,
      label: ru.recipes.servingLabel,
      grams,
    });
  }
}

// Stores what calcRecipe says into the recipe's food row, so search and the diary read it as is.
export async function recomputeRecipe(db: Db, recipeId: string): Promise<void> {
  const [recipe] = await db
    .select({
      foodId: recipes.foodId,
      userId: recipes.userId,
      cookedWeightG: recipes.cookedWeightG,
      servings: recipes.servings,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);
  if (!recipe) throw new Error(`recipe ${recipeId} not found`);
  const result = calcRecipe(await loadRecipeItemValues(db, recipeId), recipe.cookedWeightG);
  await db
    .update(foods)
    .set({ ...result.per100g, fiber100: null, updatedAt: sql`now()` })
    .where(eq(foods.id, recipe.foodId));
  await syncServingPortion(db, recipe, result.weightG);
}

export async function recomputeRecipesUsingFoods(
  db: Db,
  foodIds: readonly string[],
): Promise<number> {
  if (foodIds.length === 0) return 0;
  const rows = await db
    .selectDistinct({ recipeId: recipeItems.recipeId })
    .from(recipeItems)
    .where(inArray(recipeItems.foodId, [...foodIds]));
  for (const { recipeId } of rows) await recomputeRecipe(db, recipeId);
  return rows.length;
}
