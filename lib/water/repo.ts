import { and, count, desc, eq, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { waterEntries } from "@/db/schema";
import type { Db } from "@/db/types";
import { WATER } from "@/lib/config";
import type { IsoDate } from "@/lib/date";

export type DayWater = { totalMl: number; lastId: string | null };

export async function getDayWater(db: Db, userId: string, date: IsoDate): Promise<DayWater> {
  const day = and(eq(waterEntries.userId, userId), eq(waterEntries.date, date));
  const [[total], [last]] = await Promise.all([
    db
      .select({ ml: sql<number>`coalesce(sum(${waterEntries.ml}), 0)::int` })
      .from(waterEntries)
      .where(day),
    db
      .select({ id: waterEntries.id })
      .from(waterEntries)
      .where(day)
      .orderBy(desc(waterEntries.createdAt), desc(waterEntries.id))
      .limit(1),
  ]);
  return { totalMl: total?.ml ?? 0, lastId: last?.id ?? null };
}

export type AddWaterInput = { date: IsoDate; ml: number; requestId?: string | null };

export async function addWater(
  db: Db,
  userId: string,
  input: AddWaterInput,
  // Injectable so tests can reach the cap without fifty inserts.
  limits: { maxEntriesPerDay: number } = WATER,
): Promise<"ok" | "limit" | "conflict"> {
  return db.transaction(async (tx) => {
    // Held for the whole check-then-insert: a replayed twin waits and then sees this row.
    await lockUserWrites(tx, userId);
    if (input.requestId) {
      const [replayed] = await tx
        .select({ date: waterEntries.date, ml: waterEntries.ml })
        .from(waterEntries)
        .where(
          and(eq(waterEntries.userId, userId), eq(waterEntries.clientRequestId, input.requestId)),
        )
        .limit(1);
      if (replayed) {
        return replayed.date === input.date && replayed.ml === input.ml ? "ok" : "conflict";
      }
    }
    const [day] = await tx
      .select({ n: count() })
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, userId), eq(waterEntries.date, input.date)));
    if ((day?.n ?? 0) >= limits.maxEntriesPerDay) return "limit";
    await tx.insert(waterEntries).values({
      userId,
      date: input.date,
      ml: input.ml,
      clientRequestId: input.requestId ?? null,
    });
    return "ok";
  });
}

// By id, not "the latest of the day": a replayed removal then finds nothing instead of pouring
// out a second glass.
export async function removeWater(
  db: Db,
  userId: string,
  entryId: string,
): Promise<{ date: IsoDate } | null> {
  const [row] = await db
    .delete(waterEntries)
    .where(and(eq(waterEntries.userId, userId), eq(waterEntries.id, entryId)))
    .returning({ date: waterEntries.date });
  return row ?? null;
}
