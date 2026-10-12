import { and, asc, count, eq, sql } from "drizzle-orm";
import { diaryEntries, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import { DIARY_LIMITS } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { getVisiblePortion, visibleTo } from "@/lib/foods/repo";
import type { PortionValues } from "@/lib/foods/types";
import { calcPortionGrams } from "@/lib/nutrition";
import type { AddAmount, AddEntryInput, DiaryEntry, UpdateEntryInput } from "./types";

const entryColumns = {
  id: diaryEntries.id,
  date: diaryEntries.date,
  meal: diaryEntries.meal,
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

const NO_PORTION = { portionLabel: null, portionGrams: null, portionCount: null };

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

function amountColumns(amount: AddAmount, portion: PortionValues | null) {
  if (amount.mode === "grams") return { grams: amount.grams, ...NO_PORTION };
  // addEntry returns "not_found" before calling this without a portion.
  if (!portion) throw new Error("portion amount without a portion");
  return {
    grams: calcPortionGrams(portion.grams, amount.count),
    portionLabel: portion.label,
    portionGrams: portion.grams,
    portionCount: amount.count,
  };
}

export async function addEntry(
  db: Db,
  userId: string,
  input: AddEntryInput,
  // Injectable so tests can reach the caps without inserting a hundred thousand rows.
  limits: { maxEntriesPerDay: number; maxEntriesTotal: number } = DIARY_LIMITS,
): Promise<"ok" | "not_found" | "limit" | "total_limit"> {
  return db.transaction(async (tx) => {
    // Serializes one user's adds so parallel submits cannot all pass the cap checks below.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
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
    const [counts] = await tx
      .select({
        total: count(),
        day: sql<number>`count(*) FILTER (WHERE ${diaryEntries.date} = ${input.date})`.mapWith(
          Number,
        ),
      })
      .from(diaryEntries)
      .where(eq(diaryEntries.userId, userId));
    if ((counts?.day ?? 0) >= limits.maxEntriesPerDay) return "limit";
    if ((counts?.total ?? 0) >= limits.maxEntriesTotal) return "total_limit";
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
      ...amountColumns(amount, portion),
    });
    return "ok";
  });
}

export async function updateEntry(
  db: Db,
  userId: string,
  entryId: string,
  input: UpdateEntryInput,
): Promise<{ date: IsoDate } | null> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ date: diaryEntries.date, portionGrams: diaryEntries.portionGrams })
      .from(diaryEntries)
      .where(ownEntry(userId, entryId))
      .limit(1);
    if (!entry) return null;
    const { amount } = input;
    let columns: Partial<typeof diaryEntries.$inferInsert>;
    if (amount.mode === "grams") {
      columns = { grams: amount.grams, ...NO_PORTION };
    } else {
      // Only the snapshotted portion can be counted; a grams entry has none to count.
      if (entry.portionGrams === null) return null;
      columns = {
        grams: calcPortionGrams(entry.portionGrams, amount.count),
        portionCount: amount.count,
      };
    }
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
