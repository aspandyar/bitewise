import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { foodPortions, foods, recipeItems, recipes } from "@/db/schema";
import type { Db } from "@/db/types";
import { ru } from "@/lib/i18n/ru";
import { calcRecipe, calcServingPortionGrams, type RecipeItemValues } from "@/lib/nutrition";

export const per100gColumns = {
  kcal100: foods.kcal100,
  protein100: foods.protein100,
  fat100: foods.fat100,
  carbs100: foods.carbs100,
};

// Deleted foods are read too: an ingredient deleted later keeps counting with its numbers.
export async function loadRecipeItemValues(
  db: Db,
  userId: string,
  recipeId: string,
): Promise<(RecipeItemValues & { id: string })[]> {
  return db
    .select({ id: recipeItems.id, grams: recipeItems.grams, per100g: per100gColumns })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(and(eq(recipeItems.recipeId, recipeId), eq(recipeItems.userId, userId)));
}

type ServingTarget = { foodId: string; userId: string; servings: number | null };

// addPortion refuses recipe foods, so the only portion a recipe food has is its serving.
async function syncServingPortion(db: Db, recipe: ServingTarget, weightG: number): Promise<void> {
  const grams = calcServingPortionGrams(weightG, recipe.servings);
  const [current] = await db
    .select({ id: foodPortions.id })
    .from(foodPortions)
    .where(eq(foodPortions.foodId, recipe.foodId))
    .limit(1);
  if (grams === null) {
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
// The row lock serializes recomputes of one recipe with its edits, so neither stores numbers from a
// composition the other has just changed, and the serving portion is never inserted twice.
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
    .limit(1)
    .for("update");
  if (!recipe) throw new Error(`recipe ${recipeId} not found`);
  const items = await loadRecipeItemValues(db, recipe.userId, recipeId);
  const result = calcRecipe(items, recipe.cookedWeightG);
  await db
    .update(foods)
    .set({ ...result.per100g, fiber100: null, updatedAt: sql`now()` })
    .where(eq(foods.id, recipe.foodId));
  await syncServingPortion(db, recipe, result.weightG);
}

// Only live recipes: deleted ones keep nothing to recompute. Sorted so that two transactions
// recomputing overlapping recipes lock them in the same order and cannot deadlock.
export async function recomputeRecipesUsingFoods(
  db: Db,
  foodIds: readonly string[],
): Promise<number> {
  if (foodIds.length === 0) return 0;
  const rows = await db
    .selectDistinct({ recipeId: recipeItems.recipeId })
    .from(recipeItems)
    .innerJoin(recipes, eq(recipes.id, recipeItems.recipeId))
    .innerJoin(foods, eq(foods.id, recipes.foodId))
    .where(and(inArray(recipeItems.foodId, [...foodIds]), isNull(foods.deletedAt)))
    .orderBy(asc(recipeItems.recipeId));
  for (const { recipeId } of rows) await recomputeRecipe(db, recipeId);
  return rows.length;
}
