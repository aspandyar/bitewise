import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { diaryEntries, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import {
  NO_PORTION,
  isStorableGrams,
  portionToPick,
  toAmountColumns,
  toUpdatedAmountColumns,
} from "@/lib/amount";
import { DIARY_LIMITS, NUTRIENT_BASE_GRAMS, QUICK, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { getVisiblePortion, visibleTo } from "@/lib/foods/repo";
import type { PortionValues } from "@/lib/foods/types";
import type { QuickEntryValues } from "./quick-entry";
import type { AddEntryInput, DiaryEntry, UpdateEntryInput } from "./types";

export const entryColumns = {
  id: diaryEntries.id,
  date: diaryEntries.date,
  meal: diaryEntries.meal,
  foodId: diaryEntries.foodId,
  foodName: diaryEntries.foodName,
  kcal100: diaryEntries.kcal100,
  protein100: diaryEntries.protein100,
  fat100: diaryEntries.fat100,
  carbs100: diaryEntries.carbs100,
  grams: diaryEntries.grams,
  portionLabel: diaryEntries.portionLabel,
  portionGrams: diaryEntries.portionGrams,
  portionCount: diaryEntries.portionCount,
};

function ownEntry(userId: string, entryId: string) {
  return and(eq(diaryEntries.id, entryId), eq(diaryEntries.userId, userId));
}

export async function getDayEntries(db: Db, userId: string, date: IsoDate): Promise<DiaryEntry[]> {
  return (
    db
      .select(entryColumns)
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
      // Enum columns sort in declaration order, which is the order of meals in a day.
      .orderBy(asc(diaryEntries.meal), asc(diaryEntries.createdAt), asc(diaryEntries.id))
  );
}

export async function countDayEntries(db: Db, userId: string, date: IsoDate): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)));
  return row?.total ?? 0;
}

export async function getEntry(
  db: Db,
  userId: string,
  entryId: string,
): Promise<DiaryEntry | null> {
  const [row] = await db
    .select(entryColumns)
    .from(diaryEntries)
    .where(ownEntry(userId, entryId))
    .limit(1);
  return row ?? null;
}

export type EntryLimits = { maxEntriesPerDay: number; maxEntriesTotal: number };

// Called under lockUserWrites: parallel submits cannot all pass the caps.
export async function checkEntryLimits(
  tx: Db,
  userId: string,
  date: IsoDate,
  adding: number,
  limits: EntryLimits,
): Promise<"limit" | "total_limit" | null> {
  const [counts] = await tx
    .select({
      total: count(),
      day: sql<number>`count(*) FILTER (WHERE ${diaryEntries.date} = ${date})`.mapWith(Number),
    })
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, userId));
  if ((counts?.day ?? 0) + adding > limits.maxEntriesPerDay) return "limit";
  if ((counts?.total ?? 0) + adding > limits.maxEntriesTotal) return "total_limit";
  return null;
}

export async function addEntry(
  db: Db,
  userId: string,
  input: AddEntryInput,
  // Injectable so tests can reach the caps without inserting a hundred thousand rows.
  limits: EntryLimits = DIARY_LIMITS,
): Promise<"ok" | "not_found" | "limit" | "total_limit" | "grams_out_of_range"> {
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
    const { amount } = input;
    let portion: PortionValues | null = null;
    if (amount.mode === "portion") {
      portion = await getVisiblePortion(tx, userId, input.foodId, amount.portionId);
      if (!portion) return "not_found";
    }
    const columns = toAmountColumns(amount, portion);
    if (!isStorableGrams(columns.grams)) return "grams_out_of_range";
    const capped = await checkEntryLimits(tx, userId, input.date, 1, limits);
    if (capped) return capped;
    await tx.insert(diaryEntries).values({
      userId,
      date: input.date,
      meal: input.meal,
      foodId: input.foodId,
      foodName: food.name,
      kcal100: food.kcal100,
      protein100: food.protein100,
      fat100: food.fat100,
      carbs100: food.carbs100,
      ...columns,
    });
    return "ok";
  });
}

export async function updateEntry(
  db: Db,
  userId: string,
  entryId: string,
  input: UpdateEntryInput,
): Promise<{ date: IsoDate } | null | "grams_out_of_range"> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select({
        date: diaryEntries.date,
        foodId: diaryEntries.foodId,
        portionGrams: diaryEntries.portionGrams,
      })
      .from(diaryEntries)
      .where(ownEntry(userId, entryId))
      .limit(1);
    // A "just kcal" entry has no amount to edit; it has its own form and update.
    if (!entry || entry.foodId === null) return null;
    const { amount } = input;
    const pick = portionToPick(amount, entry.portionGrams);
    const picked = pick ? await getVisiblePortion(tx, userId, entry.foodId, pick) : null;
    const columns = toUpdatedAmountColumns(amount, entry.portionGrams, picked);
    if (!columns) return null;
    if (!isStorableGrams(columns.grams)) return "grams_out_of_range";
    await tx
      .update(diaryEntries)
      .set({ meal: input.meal, ...columns, updatedAt: sql`now()` })
      .where(ownEntry(userId, entryId));
    return { date: entry.date };
  });
}

export async function deleteEntry(
  db: Db,
  userId: string,
  entryId: string,
): Promise<{ date: IsoDate } | null> {
  const [row] = await db
    .delete(diaryEntries)
    .where(ownEntry(userId, entryId))
    .returning({ date: diaryEntries.date });
  return row ?? null;
}

// Undo of a quick add or a repeat: ids come from the URL, so only the user's own entries, and only
// ones created within the undo window, are touched.
export async function deleteOwnEntries(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .delete(diaryEntries)
    .where(
      and(
        eq(diaryEntries.userId, userId),
        inArray(diaryEntries.id, [...ids]),
        gt(diaryEntries.createdAt, sql`now() - ${QUICK.undoWindowMs} * interval '1 millisecond'`),
      ),
    )
    .returning({ id: diaryEntries.id });
  return rows.length;
}

// A "just kcal" entry is stored as 100 g of something with the typed numbers per 100 g, so day
// totals go through calcEntryNutrients like every other entry.
function quickEntryColumns(values: QuickEntryValues) {
  return {
    foodId: null,
    foodName: values.name,
    kcal100: values.kcal,
    protein100: values.proteinG,
    fat100: values.fatG,
    carbs100: values.carbsG,
    grams: NUTRIENT_BASE_GRAMS,
    ...NO_PORTION,
  };
}

export async function addQuickEntry(
  db: Db,
  userId: string,
  input: { date: IsoDate; meal: Meal; values: QuickEntryValues },
  limits: EntryLimits = DIARY_LIMITS,
): Promise<{ id: string } | "limit" | "total_limit"> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const capped = await checkEntryLimits(tx, userId, input.date, 1, limits);
    if (capped) return capped;
    const [row] = await tx
      .insert(diaryEntries)
      .values({ userId, date: input.date, meal: input.meal, ...quickEntryColumns(input.values) })
      .returning({ id: diaryEntries.id });
    if (!row) throw new Error("quick entry insert returned no row");
    return row;
  });
}

export async function updateQuickEntry(
  db: Db,
  userId: string,
  entryId: string,
  input: { meal: Meal; values: QuickEntryValues },
): Promise<{ date: IsoDate } | null> {
  const [row] = await db
    .update(diaryEntries)
    .set({ meal: input.meal, ...quickEntryColumns(input.values), updatedAt: sql`now()` })
    .where(and(ownEntry(userId, entryId), isNull(diaryEntries.foodId)))
    .returning({ date: diaryEntries.date });
  return row ?? null;
}
