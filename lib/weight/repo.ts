import { and, desc, eq, gte, sql } from "drizzle-orm";
import { lockUserWrites } from "@/db/locks";
import { weightEntries } from "@/db/schema";
import type { Db } from "@/db/types";
import type { WeightEntry } from "@/lib/body";
import type { IsoDate } from "@/lib/date";
import { getProfile, saveProfile } from "@/lib/profile/repo";

// Newest first: the history reads top-down from today.
export async function listWeights(db: Db, userId: string, from: IsoDate): Promise<WeightEntry[]> {
  return db
    .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), gte(weightEntries.date, from)))
    .orderBy(desc(weightEntries.date));
}

export async function getWeight(db: Db, userId: string, date: IsoDate): Promise<number | null> {
  const [row] = await db
    .select({ weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)))
    .limit(1);
  return row?.weightKg ?? null;
}

// The profile weight follows the newest weigh-in, so an auto target's protein (g per kg) follows
// the scale; saveProfile leaves a manual target alone. With no weigh-ins left the profile keeps
// what it had: it is still the best known weight.
async function syncProfileWeight(tx: Db, userId: string, today: IsoDate): Promise<void> {
  const [latest] = await tx
    .select({ weightKg: weightEntries.weightKg })
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  if (!latest) return;
  const profile = await getProfile(tx, userId);
  if (!profile || profile.weightKg === latest.weightKg) return;
  await saveProfile(tx, userId, { ...profile, weightKg: latest.weightKg }, today);
}

// One weigh-in per day: saving the same day again replaces it, so a replayed save is harmless.
export async function saveWeight(
  db: Db,
  userId: string,
  input: WeightEntry,
  today: IsoDate,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Two saves in parallel must not leave the profile on the older one's weight.
    await lockUserWrites(tx, userId);
    await tx
      .insert(weightEntries)
      .values({ userId, date: input.date, weightKg: input.weightKg })
      .onConflictDoUpdate({
        target: [weightEntries.userId, weightEntries.date],
        set: { weightKg: input.weightKg, updatedAt: sql`now()` },
      });
    await syncProfileWeight(tx, userId, today);
  });
}

export async function deleteWeight(
  db: Db,
  userId: string,
  date: IsoDate,
  today: IsoDate,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockUserWrites(tx, userId);
    await tx
      .delete(weightEntries)
      .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)));
    await syncProfileWeight(tx, userId, today);
  });
}
