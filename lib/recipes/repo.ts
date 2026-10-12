import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { foodPortions, foods, recipeItems, recipes } from "@/db/schema";
import type { Db } from "@/db/types";
import { NO_PORTION, toAmountColumns, type AddAmount, type UpdateAmount } from "@/lib/amount";
import { RECIPE_LIMITS } from "@/lib/config";
import { createFood, getVisiblePortion, notRecipe, visibleTo } from "@/lib/foods/repo";
import type { PortionValues } from "@/lib/foods/types";
import { calcPortionGrams, calcRecipe, type RecipeItemValues } from "@/lib/nutrition";
import { loadRecipeItemValues, per100gColumns, recomputeRecipe } from "./recompute";
import type { RecipeDetails, RecipeListItem, RecipeValues, RecipeWriteResult } from "./types";

// A recipe lives while its food row does: deleting a recipe soft-deletes that row.
function ownLiveRecipe(userId: string, recipeId: string) {
  return and(eq(recipes.id, recipeId), eq(recipes.userId, userId), isNull(foods.deletedAt));
}

// A stated weight must stay plausible for the composition; without one the raw weight always is.
function weightTooLow(items: readonly RecipeItemValues[], cookedWeightG: number | null): boolean {
  return cookedWeightG !== null && calcRecipe(items, cookedWeightG).weightRaised;
}

// Serializes writes to one recipe, so parallel adds cannot pass the item cap or store numbers
// computed from a composition another request has just changed.
async function lockOwnRecipe(tx: Db, userId: string, recipeId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${recipeId}))`);
  const [recipe] = await tx
    .select({ foodId: recipes.foodId, cookedWeightG: recipes.cookedWeightG })
    .from(recipes)
    .innerJoin(foods, eq(foods.id, recipes.foodId))
    .where(ownLiveRecipe(userId, recipeId))
    .limit(1);
  return recipe ?? null;
}

export async function countRecipes(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(recipes)
    .innerJoin(foods, eq(foods.id, recipes.foodId))
    .where(and(eq(recipes.userId, userId), isNull(foods.deletedAt)));
  return row?.total ?? 0;
}

// Bounded by FOOD_LIMITS.maxOwnFoods, since every recipe is an own food.
export async function listRecipes(db: Db, userId: string): Promise<RecipeListItem[]> {
  return db
    .select({
      id: recipes.id,
      name: foods.name,
      per100g: per100gColumns,
      servingGrams: foodPortions.grams,
    })
    .from(recipes)
    .innerJoin(foods, eq(foods.id, recipes.foodId))
    .leftJoin(foodPortions, eq(foodPortions.foodId, recipes.foodId))
    .where(and(eq(recipes.userId, userId), isNull(foods.deletedAt)))
    .orderBy(desc(recipes.createdAt), desc(recipes.id));
}

export async function getRecipe(
  db: Db,
  userId: string,
  recipeId: string,
): Promise<RecipeDetails | null> {
  const [recipe] = await db
    .select({
      id: recipes.id,
      foodId: recipes.foodId,
      name: foods.name,
      cookedWeightG: recipes.cookedWeightG,
      servings: recipes.servings,
    })
    .from(recipes)
    .innerJoin(foods, eq(foods.id, recipes.foodId))
    .where(ownLiveRecipe(userId, recipeId))
    .limit(1);
  if (!recipe) return null;
  const items = await db
    .select({
      id: recipeItems.id,
      foodId: recipeItems.foodId,
      foodName: foods.name,
      foodDeleted: sql<boolean>`${foods.deletedAt} IS NOT NULL`,
      per100g: per100gColumns,
      grams: recipeItems.grams,
      portionLabel: recipeItems.portionLabel,
      portionGrams: recipeItems.portionGrams,
      portionCount: recipeItems.portionCount,
    })
    .from(recipeItems)
    .innerJoin(foods, eq(foods.id, recipeItems.foodId))
    .where(eq(recipeItems.recipeId, recipeId))
    .orderBy(asc(recipeItems.createdAt), asc(recipeItems.id));
  return { ...recipe, items };
}

export async function getRecipeIdByFoodId(
  db: Db,
  userId: string,
  foodId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.foodId, foodId), eq(recipes.userId, userId)))
    .limit(1);
  return row?.id ?? null;
}

export async function createRecipe(
  db: Db,
  userId: string,
  values: RecipeValues,
): Promise<{ id: string } | "limit"> {
  return db.transaction(async (tx) => {
    const food = await createFood(tx, userId, {
      name: values.name,
      kcal100: 0,
      protein100: 0,
      fat100: 0,
      carbs100: 0,
      fiber100: null,
    });
    if (food === "limit") return food;
    const [row] = await tx
      .insert(recipes)
      .values({
        userId,
        foodId: food.id,
        cookedWeightG: values.cookedWeightG,
        servings: values.servings,
      })
      .returning({ id: recipes.id });
    if (!row) throw new Error("recipe insert returned no row");
    await recomputeRecipe(tx, row.id);
    return row;
  });
}

export async function updateRecipe(
  db: Db,
  userId: string,
  recipeId: string,
  values: RecipeValues,
): Promise<"ok" | "not_found" | "weight_too_low"> {
  return db.transaction(async (tx) => {
    const recipe = await lockOwnRecipe(tx, userId, recipeId);
    if (!recipe) return "not_found";
    if (weightTooLow(await loadRecipeItemValues(tx, recipeId), values.cookedWeightG)) {
      return "weight_too_low";
    }
    await tx
      .update(foods)
      .set({ name: values.name, updatedAt: sql`now()` })
      .where(eq(foods.id, recipe.foodId));
    await tx
      .update(recipes)
      .set({
        cookedWeightG: values.cookedWeightG,
        servings: values.servings,
        updatedAt: sql`now()`,
      })
      .where(eq(recipes.id, recipeId));
    await recomputeRecipe(tx, recipeId);
    return "ok";
  });
}

export async function deleteRecipe(db: Db, userId: string, recipeId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const recipe = await lockOwnRecipe(tx, userId, recipeId);
    if (!recipe) return false;
    // Soft delete: diary entries keep pointing at the recipe's food.
    await tx
      .update(foods)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(foods.id, recipe.foodId));
    return true;
  });
}

export async function addItem(
  db: Db,
  userId: string,
  recipeId: string,
  input: { foodId: string; amount: AddAmount },
  // Injectable so tests can reach the cap without inserting fifty rows.
  limits: { maxItems: number } = RECIPE_LIMITS,
): Promise<RecipeWriteResult> {
  return db.transaction(async (tx) => {
    const recipe = await lockOwnRecipe(tx, userId, recipeId);
    if (!recipe) return "not_found";
    // Not a recipe: dishes inside dishes are not supported, which also rules out cycles.
    const [food] = await tx
      .select(per100gColumns)
      .from(foods)
      .where(and(eq(foods.id, input.foodId), visibleTo(userId), notRecipe))
      .limit(1);
    if (!food) return "not_found";
    let portion: PortionValues | null = null;
    if (input.amount.mode === "portion") {
      portion = await getVisiblePortion(tx, userId, input.foodId, input.amount.portionId);
      if (!portion) return "not_found";
    }
    const items = await loadRecipeItemValues(tx, recipeId);
    if (items.length >= limits.maxItems) return "limit";
    const columns = toAmountColumns(input.amount, portion);
    if (weightTooLow([...items, { per100g: food, grams: columns.grams }], recipe.cookedWeightG)) {
      return "weight_too_low";
    }
    await tx.insert(recipeItems).values({ recipeId, userId, foodId: input.foodId, ...columns });
    await recomputeRecipe(tx, recipeId);
    return "ok";
  });
}

export async function updateItem(
  db: Db,
  userId: string,
  recipeId: string,
  itemId: string,
  amount: UpdateAmount,
): Promise<"ok" | "not_found" | "weight_too_low"> {
  return db.transaction(async (tx) => {
    const recipe = await lockOwnRecipe(tx, userId, recipeId);
    if (!recipe) return "not_found";
    const [item] = await tx
      .select({ portionGrams: recipeItems.portionGrams })
      .from(recipeItems)
      .where(and(eq(recipeItems.id, itemId), eq(recipeItems.recipeId, recipeId)))
      .limit(1);
    if (!item) return "not_found";
    let grams: number;
    if (amount.mode === "grams") {
      grams = amount.grams;
    } else {
      // Only the snapshotted portion can be counted; a grams ingredient has none to count.
      if (item.portionGrams === null) return "not_found";
      grams = calcPortionGrams(item.portionGrams, amount.count);
    }
    const items = (await loadRecipeItemValues(tx, recipeId)).map((current) =>
      current.id === itemId ? { ...current, grams } : current,
    );
    if (weightTooLow(items, recipe.cookedWeightG)) return "weight_too_low";
    await tx
      .update(recipeItems)
      .set(
        amount.mode === "grams" ? { grams, ...NO_PORTION } : { grams, portionCount: amount.count },
      )
      .where(eq(recipeItems.id, itemId));
    await recomputeRecipe(tx, recipeId);
    return "ok";
  });
}

export async function deleteItem(
  db: Db,
  userId: string,
  recipeId: string,
  itemId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const recipe = await lockOwnRecipe(tx, userId, recipeId);
    if (!recipe) return false;
    const rows = await tx
      .delete(recipeItems)
      .where(and(eq(recipeItems.id, itemId), eq(recipeItems.recipeId, recipeId)))
      .returning({ id: recipeItems.id });
    if (rows.length === 0) return false;
    await recomputeRecipe(tx, recipeId);
    return true;
  });
}
