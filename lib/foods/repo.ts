import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { foodPortions, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import { FOOD_LIMITS, FOOD_SEARCH, PORTION_LIMITS } from "@/lib/config";
import { escapeLike } from "./search";
import type { FoodDetails, FoodListItem, FoodValues, PortionItem, PortionValues } from "./types";

// Every read goes through this filter: shared or own, and never soft-deleted.
export function visibleTo(userId: string) {
  return and(isNull(foods.deletedAt), or(isNull(foods.ownerId), eq(foods.ownerId, userId)));
}

function ownedBy(userId: string, foodId: string) {
  return and(eq(foods.id, foodId), eq(foods.ownerId, userId), isNull(foods.deletedAt));
}

// A visible food with an owner can only be the caller's, so this never reveals other users.
const isOwnColumn = sql<boolean>`${foods.ownerId} IS NOT NULL`;

export const listColumns = {
  id: foods.id,
  name: foods.name,
  kcal100: foods.kcal100,
  protein100: foods.protein100,
  fat100: foods.fat100,
  carbs100: foods.carbs100,
  source: foods.source,
  isOwn: isOwnColumn,
};

export async function getVisibleFood(
  db: Db,
  userId: string,
  foodId: string,
): Promise<FoodDetails | null> {
  const [row] = await db
    .select({ ...listColumns, fiber100: foods.fiber100, sourceUrl: foods.sourceUrl })
    .from(foods)
    .where(and(eq(foods.id, foodId), visibleTo(userId)))
    .limit(1);
  return row ?? null;
}

export async function listOwnFoods(db: Db, userId: string, limit: number): Promise<FoodListItem[]> {
  return db
    .select(listColumns)
    .from(foods)
    .where(and(eq(foods.ownerId, userId), isNull(foods.deletedAt)))
    .orderBy(desc(foods.createdAt), desc(foods.id))
    .limit(limit);
}

// Two simultaneous creates can overshoot by one; the cap bounds abuse, it is not exact accounting.
export async function createFood(
  db: Db,
  userId: string,
  values: FoodValues,
): Promise<{ id: string } | "limit"> {
  const [owned] = await db
    .select({ total: count() })
    .from(foods)
    .where(and(eq(foods.ownerId, userId), isNull(foods.deletedAt)));
  if ((owned?.total ?? 0) >= FOOD_LIMITS.maxOwnFoods) return "limit";
  const [row] = await db
    .insert(foods)
    .values({ ...values, ownerId: userId, source: "user" })
    .returning({ id: foods.id });
  if (!row) throw new Error("food insert returned no row");
  return row;
}

export async function updateOwnFood(
  db: Db,
  userId: string,
  foodId: string,
  values: FoodValues,
): Promise<boolean> {
  const rows = await db
    .update(foods)
    .set({ ...values, updatedAt: sql`now()` })
    .where(ownedBy(userId, foodId))
    .returning({ id: foods.id });
  return rows.length > 0;
}

export async function softDeleteOwnFood(db: Db, userId: string, foodId: string): Promise<boolean> {
  const rows = await db
    .update(foods)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(ownedBy(userId, foodId))
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
        isOwn: sql<boolean>`${foodPortions.userId} IS NOT NULL`,
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
      })
      .from(foods)
      .where(and(eq(foods.id, foodId), visibleTo(userId)))
      .limit(1);
    if (!source) return null;
    const copy = await createFood(tx, userId, source);
    if (copy === "limit") return copy;
    const portions = await listVisiblePortions(tx, userId, foodId);
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
    const [food] = await tx
      .select({ id: foods.id })
      .from(foods)
      .where(and(eq(foods.id, foodId), visibleTo(userId)))
      .limit(1);
    if (!food) return "not_found";
    // Two simultaneous submits can overshoot by one; the cap is a UX limit, not a security one.
    const [owned] = await tx
      .select({ total: count() })
      .from(foodPortions)
      .where(and(eq(foodPortions.foodId, foodId), eq(foodPortions.userId, userId)));
    if ((owned?.total ?? 0) >= PORTION_LIMITS.maxOwnPerFood) return "limit";
    await tx.insert(foodPortions).values({ foodId, userId, ...portion });
    return "ok";
  });
}

export async function deleteOwnPortion(
  db: Db,
  userId: string,
  portionId: string,
): Promise<boolean> {
  const rows = await db
    .delete(foodPortions)
    .where(and(eq(foodPortions.id, portionId), eq(foodPortions.userId, userId)))
    .returning({ id: foodPortions.id });
  return rows.length > 0;
}

// `query` must come from normalizeFoodQuery: it already matches search_name's lower/ё→е form.
export async function searchFoods(db: Db, userId: string, query: string): Promise<FoodListItem[]> {
  const escaped = escapeLike(query);
  const namePrefix = `${escaped}%`;
  const wordPrefix = `% ${escaped}%`;
  const startsWord = sql`(${foods.searchName} LIKE ${namePrefix} OR ${foods.searchName} LIKE ${wordPrefix})`;
  const match =
    query.length >= FOOD_SEARCH.minTrigramLength
      ? sql`(${startsWord} OR ${query} <% ${foods.searchName})`
      : startsWord;

  return db.transaction(async (tx) => {
    // `<%` reads its cut-off from this setting; LOCAL keeps it inside this transaction.
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(FOOD_SEARCH.wordSimilarityThreshold)}, true)`,
    );
    return tx
      .select(listColumns)
      .from(foods)
      .where(and(visibleTo(userId), match))
      .orderBy(
        sql`${foods.ownerId} IS NULL`,
        sql`${foods.searchName} LIKE ${namePrefix} DESC`,
        sql`${foods.searchName} LIKE ${wordPrefix} DESC`,
        sql`word_similarity(${query}, ${foods.searchName}) DESC`,
        asc(foods.name),
      )
      .limit(FOOD_SEARCH.limit);
  });
}
