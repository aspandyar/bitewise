import { and, asc, count, desc, eq, inArray, isNotNull, lt, max, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { diaryEntries, favorites, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import type { AmountColumns } from "@/lib/amount";
import { DIARY_LIMITS, QUICK, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { listColumnsFor, visibleTo } from "@/lib/foods/repo";
import { calcEntryNutrients } from "@/lib/nutrition";
import { lastAmount } from "./quick";
import { checkEntryLimits, entryColumns, type EntryLimits } from "./repo";
import type { DiaryEntry } from "./types";

export type QuickFood = {
  foodId: string;
  name: string;
  isRecipe: boolean;
  // Null for a favorite never logged: tapping it opens the amount screen instead.
  amount: AmountColumns | null;
  // From the food's current numbers, the same ones a quick add snapshots.
  kcal: number | null;
};

const amountColumns = {
  grams: diaryEntries.grams,
  portionLabel: diaryEntries.portionLabel,
  portionGrams: diaryEntries.portionGrams,
  portionCount: diaryEntries.portionCount,
};

type FoodRow = {
  id: string;
  name: string;
  isRecipe: boolean;
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
};

function toQuickFood(food: FoodRow, last: AmountColumns | null): QuickFood {
  const amount = last ? lastAmount(last) : null;
  return {
    foodId: food.id,
    name: food.name,
    isRecipe: food.isRecipe,
    amount,
    kcal: amount ? calcEntryNutrients(food, amount.grams).kcal : null,
  };
}

// This meal's foods first, newest first, then the rest; each food once, with its last amount.
// Only the latest entries are scanned: "recent" is about weeks, not the whole history.
export async function listRecentFoods(
  db: Db,
  userId: string,
  meal: Meal,
  limit: number,
  exclude: ReadonlySet<string>,
): Promise<QuickFood[]> {
  const rows = await db
    .select({ ...listColumnsFor(userId), meal: diaryEntries.meal, ...amountColumns })
    .from(diaryEntries)
    .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
    .where(and(eq(diaryEntries.userId, userId), isNotNull(diaryEntries.foodId), visibleTo(userId)))
    .orderBy(desc(diaryEntries.createdAt), desc(diaryEntries.id))
    .limit(QUICK.recentScanEntries);

  const seen = new Map<string, { row: (typeof rows)[number]; atMeal: boolean; order: number }>();
  rows.forEach((row, order) => {
    if (exclude.has(row.id)) return;
    const known = seen.get(row.id);
    if (!known) seen.set(row.id, { row, atMeal: row.meal === meal, order });
    else if (!known.atMeal && row.meal === meal) known.atMeal = true;
  });
  return (
    [...seen.values()]
      // Stable: within each group the newest-first order of the scan is kept.
      .sort((a, b) => Number(b.atMeal) - Number(a.atMeal) || a.order - b.order)
      .slice(0, limit)
      .map(({ row }) => toQuickFood(row, row))
  );
}

export async function listFavoriteFoods(db: Db, userId: string): Promise<QuickFood[]> {
  const starred = await db
    .select(listColumnsFor(userId))
    .from(favorites)
    .innerJoin(foods, eq(foods.id, favorites.foodId))
    .where(and(eq(favorites.userId, userId), visibleTo(userId)))
    .orderBy(desc(favorites.createdAt), asc(foods.name));
  if (starred.length === 0) return [];
  const last = await db
    .selectDistinctOn([diaryEntries.foodId], { foodId: diaryEntries.foodId, ...amountColumns })
    .from(diaryEntries)
    .where(
      and(
        eq(diaryEntries.userId, userId),
        inArray(
          diaryEntries.foodId,
          starred.map((food) => food.id),
        ),
      ),
    )
    .orderBy(diaryEntries.foodId, desc(diaryEntries.createdAt), desc(diaryEntries.id));
  const lastByFood = new Map(last.map((row) => [row.foodId, row]));
  return starred.map((food) => toQuickFood(food, lastByFood.get(food.id) ?? null));
}

export async function isFavorite(db: Db, userId: string, foodId: string): Promise<boolean> {
  const [row] = await db
    .select({ foodId: favorites.foodId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.foodId, foodId)))
    .limit(1);
  return row !== undefined;
}

export type RepeatSource = { date: IsoDate; entries: DiaryEntry[] };

// Only an empty meal is offered a repeat, so one tap cannot double it.
export async function findRepeatSource(
  db: Db,
  userId: string,
  date: IsoDate,
  meal: Meal,
): Promise<RepeatSource | null> {
  const ofMeal = and(eq(diaryEntries.userId, userId), eq(diaryEntries.meal, meal));
  const [filled] = await db
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(and(ofMeal, eq(diaryEntries.date, date)))
    .limit(1);
  if (filled) return null;
  const [last] = await db
    .select({ date: max(diaryEntries.date) })
    .from(diaryEntries)
    .where(and(ofMeal, lt(diaryEntries.date, date)));
  if (!last?.date) return null;
  const entries = await db
    .select(entryColumns)
    .from(diaryEntries)
    .where(and(ofMeal, eq(diaryEntries.date, last.date)))
    .orderBy(asc(diaryEntries.createdAt), asc(diaryEntries.id));
  return { date: last.date, entries };
}

// The same amount as the food's last entry, snapshotted from the food as it is now. The portion
// comes from that entry's snapshot: the portion itself may have been deleted since.
export async function quickAddEntry(
  db: Db,
  userId: string,
  input: { date: IsoDate; meal: Meal; foodId: string },
  limits: EntryLimits = DIARY_LIMITS,
): Promise<{ id: string } | "not_found" | "no_amount" | "limit" | "total_limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [food] = await tx
      .select({
        name: foods.name,
        kcal100: foods.kcal100,
        protein100: foods.protein100,
        fat100: foods.fat100,
        carbs100: foods.carbs100,
      })
      .from(foods)
      .where(and(eq(foods.id, input.foodId), visibleTo(userId)))
      .limit(1);
    if (!food) return "not_found";
    const [last] = await tx
      .select(amountColumns)
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.foodId, input.foodId)))
      .orderBy(desc(diaryEntries.createdAt), desc(diaryEntries.id))
      .limit(1);
    if (!last) return "no_amount";
    const capped = await checkEntryLimits(tx, userId, input.date, 1, limits);
    if (capped) return capped;
    const [row] = await tx
      .insert(diaryEntries)
      .values({
        userId,
        date: input.date,
        meal: input.meal,
        foodId: input.foodId,
        foodName: food.name,
        kcal100: food.kcal100,
        protein100: food.protein100,
        fat100: food.fat100,
        carbs100: food.carbs100,
        ...lastAmount(last),
      })
      .returning({ id: diaryEntries.id });
    if (!row) throw new Error("quick add insert returned no row");
    return row;
  });
}

// Copies the entries as they were (snapshots included): the same meal, the same numbers.
export async function repeatMeal(
  db: Db,
  userId: string,
  input: { date: IsoDate; meal: Meal },
  limits: EntryLimits = DIARY_LIMITS,
): Promise<{ ids: string[] } | "nothing" | "not_empty" | "limit" | "total_limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const source = await findRepeatSource(tx, userId, input.date, input.meal);
    if (!source) {
      const [filled] = await tx
        .select({ id: diaryEntries.id })
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, userId),
            eq(diaryEntries.date, input.date),
            eq(diaryEntries.meal, input.meal),
          ),
        )
        .limit(1);
      return filled ? "not_empty" : "nothing";
    }
    const capped = await checkEntryLimits(tx, userId, input.date, source.entries.length, limits);
    if (capped) return capped;
    const rows = await tx
      .insert(diaryEntries)
      .values(
        source.entries.map((entry, index) => ({
          userId,
          // One statement shares now(); the offset keeps the source's order in the day list.
          createdAt: sql`now() + ${index} * interval '1 microsecond'`,
          date: input.date,
          meal: input.meal,
          foodId: entry.foodId,
          foodName: entry.foodName,
          kcal100: entry.kcal100,
          protein100: entry.protein100,
          fat100: entry.fat100,
          carbs100: entry.carbs100,
          grams: entry.grams,
          portionLabel: entry.portionLabel,
          portionGrams: entry.portionGrams,
          portionCount: entry.portionCount,
        })),
      )
      .returning({ id: diaryEntries.id });
    return { ids: rows.map((row) => row.id) };
  });
}

export async function toggleFavorite(
  db: Db,
  userId: string,
  foodId: string,
  // Injectable so tests can reach the cap without starring a hundred foods.
  maxFavorites: number = QUICK.maxFavorites,
): Promise<"added" | "removed" | "not_found" | "limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [food] = await tx
      .select({ id: foods.id })
      .from(foods)
      .where(and(eq(foods.id, foodId), visibleTo(userId)))
      .limit(1);
    if (!food) return "not_found";
    const removed = await tx
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.foodId, foodId)))
      .returning({ foodId: favorites.foodId });
    if (removed.length > 0) return "removed";
    // Foods are only soft-deleted, so their stars stay in the table; they must not fill the cap.
    const [owned] = await tx
      .select({ total: count() })
      .from(favorites)
      .innerJoin(foods, eq(foods.id, favorites.foodId))
      .where(and(eq(favorites.userId, userId), visibleTo(userId)));
    if ((owned?.total ?? 0) >= maxFavorites) return "limit";
    await tx.insert(favorites).values({ userId, foodId });
    return "added";
  });
}
