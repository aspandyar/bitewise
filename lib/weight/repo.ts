import { and, desc, eq, gte, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { weightEntries } from "@/db/schema";
import type { Db } from "@/db/types";
import type { WeightEntry } from "@/lib/body";
import type { IsoDate } from "@/lib/date";
import { updateProfileWeight } from "@/lib/profile/repo";

// Newest first: the history reads top-down from today.
export async function listWeights(db: Db, userId: string, from: IsoDate): Promise<WeightEntry[]> {
  return db
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, from)))
    .orderBy(desc(weightEntries.date));
}

export type WeightRow = { id: string; weightKg: number };

export async function getWeight(db: Db, userId: string, date: IsoDate): Promise<WeightRow | null> {
  const [row] = await db
    .select({ id: weightEntries.id, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)))
    .limit(1);
  return row ?? null;
}

async function getLatestWeight(tx: Db, userId: string): Promise<WeightEntry | null> {
  const [latest] = await tx
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  return latest ?? null;
}

// The profile weight follows the newest weigh-in, so an auto target's protein (g per kg) follows
// the scale; a manual target is left alone. Only a change to the newest weigh-in touches the
// profile: fixing last week's entry must not undo a weight typed in the profile since.
export async function saveWeight(
  db: Db,
  userId: string,
  input: WeightEntry,
  today: IsoDate,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Two saves in parallel must not leave the profile on the older one's weight.
    await lockUserWrites(tx, userId);
    // One weigh-in per day: saving the same day again replaces it.
    await tx
      .insert(weightEntries)
      .values({ userId, date: input.date, weightKg: input.weightKg })
      .onConflictDoUpdate({
        target: [weightEntries.userId, weightEntries.date],
        set: { weightKg: input.weightKg, updatedAt: sql`now()` },
      });
    const latest = await getLatestWeight(tx, userId);
    if (latest?.date === input.date) {
      await updateProfileWeight(tx, userId, latest.weightKg, today);
    }
  });
}

// The edit screen saves by id: going Back to it after a delete must not bring the weigh-in back,
// so a missing row is reported instead of re-created.
export async function updateWeight(
  db: Db,
  userId: string,
  entryId: string,
  weightKg: number,
  today: IsoDate,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [updated] = await tx
      .update(weightEntries)
      .set({ weightKg, updatedAt: sql`now()` })
      .where(and(eq(weightEntries.userId, userId), eq(weightEntries.id, entryId)))
      .returning({ date: weightEntries.date });
    if (!updated) return false;
    const latest = await getLatestWeight(tx, userId);
    if (latest?.date === updated.date) {
      await updateProfileWeight(tx, userId, latest.weightKg, today);
    }
    return true;
  });
}

// By id, not by date: a replayed delete must not take a weigh-in entered again for that day,
// nor one of another account signed in on the same device since (#107). Deleting the newest
// weigh-in moves the profile to the one before it; with none left the profile keeps its weight.
export async function deleteWeight(
  db: Db,
  userId: string,
  entryId: string,
  today: IsoDate,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    const [deleted] = await tx
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, userId), eq(weightEntries.id, entryId)))
      .returning({ date: weightEntries.date });
    if (!deleted) return false;
    const latest = await getLatestWeight(tx, userId);
    // ISO dates compare correctly as plain strings.
    if (latest && deleted.date > latest.date) {
      await updateProfileWeight(tx, userId, latest.weightKg, today);
    }
    return true;
  });
}
