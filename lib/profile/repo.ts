import { and, eq, ne, sql } from "drizzle-orm";
import { profiles } from "@/db/schema";
import type { Db } from "@/db/types";
import type { IsoDate } from "@/lib/date";
import { calcAutoTargets, type ProfileData } from "@/lib/nutrition";
import { getDefaultTarget, upsertDefaultTarget } from "@/lib/targets/repo";

export async function getProfile(db: Db, userId: string): Promise<ProfileData | null> {
  const [row] = await db
    .select(profileColumns)
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

const profileColumns = {
  sex: profiles.sex,
  birthDate: profiles.birthDate,
  heightCm: profiles.heightCm,
  weightKg: profiles.weightKg,
  activityLevel: profiles.activityLevel,
  goal: profiles.goal,
};

// A manual target is the user's explicit choice, so a profile change must not overwrite it.
async function syncAutoTarget(
  tx: Db,
  userId: string,
  profile: ProfileData,
  today: IsoDate,
): Promise<void> {
  const current = await getDefaultTarget(tx, userId);
  if (current?.mode === "manual") return;
  await upsertDefaultTarget(tx, userId, calcAutoTargets(profile, today), "auto");
}

// One transaction: a profile must never exist without its default target.
export async function saveProfile(
  db: Db,
  userId: string,
  profile: ProfileData,
  today: IsoDate,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...profile })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...profile, updatedAt: sql`now()` } });
    await syncAutoTarget(tx, userId, profile, today);
  });
}

// Only the weight column: a whole profile read earlier and written back would undo a profile
// edit saved in between (another tab). The auto target is then computed from the row as it is.
// Runs inside the caller's transaction.
export async function updateProfileWeight(
  tx: Db,
  userId: string,
  weightKg: number,
  today: IsoDate,
): Promise<void> {
  const [profile] = await tx
    .update(profiles)
    .set({ weightKg, updatedAt: sql`now()` })
    .where(and(eq(profiles.userId, userId), ne(profiles.weightKg, weightKg)))
    .returning(profileColumns);
  if (profile) await syncAutoTarget(tx, userId, profile, today);
}

export async function resetTargetToAuto(db: Db, userId: string, today: IsoDate): Promise<boolean> {
  const profile = await getProfile(db, userId);
  if (!profile) return false;
  await upsertDefaultTarget(db, userId, calcAutoTargets(profile, today), "auto");
  return true;
}
