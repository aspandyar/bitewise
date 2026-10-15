import { and, asc, desc, eq, inArray, isNotNull, lt, max } from "drizzle-orm";
import { diaryEntries, favorites, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import type { AmountColumns } from "@/lib/amount";
import { QUICK, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { listColumnsFor, visibleTo } from "@/lib/foods/repo";
import { calcEntryNutrients } from "@/lib/nutrition";
import { lastAmount } from "./quick";
import { entryColumns } from "./repo";
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
