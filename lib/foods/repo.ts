import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { foodPortions, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import { FOOD_LIMITS, FOOD_SEARCH, PORTION_LIMITS, type FoodSource } from "@/lib/config";
import { recomputeRecipesUsingFoods } from "@/lib/recipes/recompute";
import { escapeLike } from "./search";
import type { FoodDetails, FoodListItem, FoodValues, PortionItem, PortionValues } from "./types";

// Every read goes through this filter: shared or own, and never soft-deleted.
export function visibleTo(userId: string) {
  return and(isNull(foods.deletedAt), or(isNull(foods.ownerId), eq(foods.ownerId, userId)));
}

function ownedBy(userId: string, foodId: string) {
  return and(eq(foods.id, foodId), eq(foods.ownerId, userId), isNull(foods.deletedAt));
}

// Qualified by hand: Drizzle leaves columns unqualified in single-table queries, and inside the
// subquery an unqualified "id" would silently mean recipes.id.
const isRecipeColumn = sql<boolean>`EXISTS (SELECT 1 FROM "recipes" WHERE "recipes"."food_id" = "foods"."id")`;

// Recipes are foods so search and the diary need no special case, but their numbers and portions
// belong to the recipe: every food-level write skips them.
export const notRecipe = sql`NOT ${isRecipeColumn}`;

// "Own" compares with the caller instead of trusting the query to filter by visibleTo, so a
// future query without that filter cannot mark someone else's food as editable.
export function listColumnsFor(userId: string) {
  return {
    id: foods.id,
    name: foods.name,
    kcal100: foods.kcal100,
    protein100: foods.protein100,
    fat100: foods.fat100,
    carbs100: foods.carbs100,
    source: foods.source,
    isOwn: sql<boolean>`${foods.ownerId} IS NOT DISTINCT FROM ${userId}::uuid`,
    isRecipe: isRecipeColumn,
  };
}

export async function getVisibleFood(
  db: Db,
  userId: string,
  foodId: string,
): Promise<FoodDetails | null> {
  const [row] = await db
    .select({
      ...listColumnsFor(userId),
      fiber100: foods.fiber100,
      sourceUrl: foods.sourceUrl,
      copiedFrom: foods.copiedFrom,
    })
    .from(foods)
    .where(and(eq(foods.id, foodId), visibleTo(userId)))
    .limit(1);
  return row ?? null;
}

export async function listOwnFoods(
  db: Db,
  userId: string,
  limit: number,
  { excludeRecipes = false }: { excludeRecipes?: boolean } = {},
): Promise<FoodListItem[]> {
  return db
    .select(listColumnsFor(userId))
    .from(foods)
    .where(
      and(
        eq(foods.ownerId, userId),
        isNull(foods.deletedAt),
        excludeRecipes ? notRecipe : undefined,
      ),
    )
    .orderBy(desc(foods.createdAt), desc(foods.id))
    .limit(limit);
}

// Copies and recipes create through here too, inside their own transaction (a savepoint then).
export async function createFood(
  db: Db,
  userId: string,
  values: FoodValues,
  copiedFrom: FoodSource | null = null,
): Promise<{ id: string } | "limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [owned] = await tx
      .select({ total: count() })
      .from(foods)
      .where(and(eq(foods.ownerId, userId), isNull(foods.deletedAt)));
    if ((owned?.total ?? 0) >= FOOD_LIMITS.maxOwnFoods) return "limit";
    const [row] = await tx
      .insert(foods)
      .values({ ...values, ownerId: userId, source: "user", copiedFrom })
      .returning({ id: foods.id });
    if (!row) throw new Error("food insert returned no row");
    return row;
  });
}

export async function updateOwnFood(
  db: Db,
  userId: string,
  foodId: string,
  values: FoodValues,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(foods)
      .set({ ...values, updatedAt: sql`now()` })
      .where(and(ownedBy(userId, foodId), notRecipe))
      .returning({ id: foods.id });
    if (rows.length === 0) return false;
    // Recipes always show their ingredients' current numbers; diary entries keep their snapshot.
    await recomputeRecipesUsingFoods(tx, [foodId]);
    return true;
  });
}

export async function softDeleteOwnFood(db: Db, userId: string, foodId: string): Promise<boolean> {
  const rows = await db
    .update(foods)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(ownedBy(userId, foodId), notRecipe))
    .returning({ id: foods.id });
  return rows.length > 0;
}

export async function listVisiblePortions(
  db: Db,
  userId: string,
  foodId: string,
): Promise<PortionItem[]> {
  return (
    db
      .select({
        id: foodPortions.id,
        label: foodPortions.label,
        grams: foodPortions.grams,
        isOwn: sql<boolean>`${foodPortions.userId} IS NOT DISTINCT FROM ${userId}::uuid`,
      })
      .from(foodPortions)
      .innerJoin(foods, eq(foods.id, foodPortions.foodId))
      .where(
        and(
          eq(foodPortions.foodId, foodId),
          visibleTo(userId),
          or(isNull(foodPortions.userId), eq(foodPortions.userId, userId)),
        ),
      )
      // Shared portions first, then the user's own in the order they were added; copies insert
      // all portions in one statement, so the label breaks created_at ties deterministically.
      .orderBy(
        sql`${foodPortions.userId} IS NOT NULL`,
        asc(foodPortions.createdAt),
        asc(foodPortions.label),
      )
  );
}

// A portion is usable only through a food the user sees and only if it belongs to that food.
export async function getVisiblePortion(
  db: Db,
  userId: string,
  foodId: string,
  portionId: string,
): Promise<PortionValues | null> {
  const [row] = await db
    .select({ label: foodPortions.label, grams: foodPortions.grams })
    .from(foodPortions)
    .innerJoin(foods, eq(foods.id, foodPortions.foodId))
    .where(
      and(
        eq(foodPortions.id, portionId),
        eq(foodPortions.foodId, foodId),
        visibleTo(userId),
        or(isNull(foodPortions.userId), eq(foodPortions.userId, userId)),
      ),
    )
    .limit(1);
  return row ?? null;
}

// Copies keep the numbers and every portion the user could see, so nothing is lost by copying.
export async function copyFood(
  db: Db,
  userId: string,
  foodId: string,
): Promise<{ id: string } | null | "limit"> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({
        name: foods.name,
        kcal100: foods.kcal100,
        protein100: foods.protein100,
        fat100: foods.fat100,
        carbs100: foods.carbs100,
        fiber100: foods.fiber100,
        source: foods.source,
        copiedFrom: foods.copiedFrom,
      })
      .from(foods)
      .where(and(eq(foods.id, foodId), visibleTo(userId), notRecipe))
      .limit(1);
    if (!source) return null;
    const { source: origin, copiedFrom, ...values } = source;
    // A copy of a copy still credits the original data; a copy of a plain own food has none.
    const credit = copiedFrom ?? (origin === "user" ? null : origin);
    const copy = await createFood(tx, userId, values, credit);
    if (copy === "limit") return copy;
    // Every copied portion becomes the user's own and so counts against the cap. Shared ones come
    // first in the list, so the slice drops generic portions before the user's.
    const portions = (await listVisiblePortions(tx, userId, foodId)).slice(
      -PORTION_LIMITS.maxOwnPerFood,
    );
    if (portions.length > 0) {
      await tx
        .insert(foodPortions)
        .values(portions.map(({ label, grams }) => ({ foodId: copy.id, userId, label, grams })));
    }
    return copy;
  });
}

export async function addPortion(
  db: Db,
  userId: string,
  foodId: string,
  portion: PortionValues,
): Promise<"ok" | "not_found" | "limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [food] = await tx
      .select({ id: foods.id })
      .from(foods)
      .where(and(eq(foods.id, foodId), visibleTo(userId), notRecipe))
      .limit(1);
    if (!food) return "not_found";
    const [owned] = await tx
      .select({ total: count() })
      .from(foodPortions)
      .where(and(eq(foodPortions.foodId, foodId), eq(foodPortions.userId, userId)));
    if ((owned?.total ?? 0) >= PORTION_LIMITS.maxOwnPerFood) return "limit";
    await tx.insert(foodPortions).values({ foodId, userId, ...portion });
    return "ok";
  });
}

// The food id comes from the page the user is on: a portion is deleted only through the food it
// belongs to, and only while the user can still see that food.
export async function deleteOwnPortion(
  db: Db,
  userId: string,
  foodId: string,
  portionId: string,
): Promise<boolean> {
  const rows = await db
    .delete(foodPortions)
    .where(
      and(
        eq(foodPortions.id, portionId),
        eq(foodPortions.foodId, foodId),
        eq(foodPortions.userId, userId),
        // food_id is qualified by hand for the same reason as isRecipeColumn; visibleTo's columns
        // stay unqualified and resolve to "foods" because the innermost FROM wins.
        sql`EXISTS (SELECT 1 FROM "foods" WHERE "foods"."id" = "food_portions"."food_id" AND ${visibleTo(userId)})`,
        // The serving portion is kept in sync by the recipe and is not the user's to delete.
        sql`NOT EXISTS (SELECT 1 FROM "recipes" WHERE "recipes"."food_id" = "food_portions"."food_id")`,
      ),
    )
    .returning({ id: foodPortions.id });
  return rows.length > 0;
}

// `query` must come from normalizeFoodQuery: it already matches search_name's lower/ё→е form.
export async function searchFoods(
  db: Db,
  userId: string,
  query: string,
  { excludeRecipes = false }: { excludeRecipes?: boolean } = {},
): Promise<FoodListItem[]> {
  const escaped = escapeLike(query);
  const namePrefix = `${escaped}%`;
  const wordPrefix = `% ${escaped}%`;
  const startsWord = sql`(${foods.searchName} LIKE ${namePrefix} OR ${foods.searchName} LIKE ${wordPrefix})`;
  const match =
    query.length >= FOOD_SEARCH.minTrigramLength
      ? sql`(${startsWord} OR (${query} <% ${foods.searchName} AND ${query} <<% ${foods.searchName}))`
      : startsWord;

  return db.transaction(async (tx) => {
    // `<%` and `<<%` read their cut-offs from these settings; LOCAL keeps them inside this
    // transaction.
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(FOOD_SEARCH.wordSimilarityThreshold)}, true), set_config('pg_trgm.strict_word_similarity_threshold', ${String(FOOD_SEARCH.strictWordSimilarityThreshold)}, true)`,
    );
    return tx
      .select(listColumnsFor(userId))
      .from(foods)
      .where(and(visibleTo(userId), match, excludeRecipes ? notRecipe : undefined))
      .orderBy(
        sql`${foods.ownerId} IS NULL`,
        sql`${foods.searchName} LIKE ${namePrefix} DESC`,
        sql`${foods.searchName} LIKE ${wordPrefix} DESC`,
        sql`word_similarity(${query}, ${foods.searchName}) DESC`,
        // Among equal prefix matches the closer whole word wins: "греч" → "гречка" before
        // "греческий", which word_similarity scores the same.
        sql`strict_word_similarity(${query}, ${foods.searchName}) DESC`,
        asc(foods.name),
      )
      .limit(FOOD_SEARCH.limit);
  });
}
