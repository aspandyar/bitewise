import { eq, sql } from "drizzle-orm";
import { profiles } from "@/db/schema";
import type { Db } from "@/db/types";
import type { IsoDate } from "@/lib/date";
import { calcAutoTargets, type ProfileData } from "@/lib/nutrition";
import { getDefaultTarget, upsertDefaultTarget } from "@/lib/targets/repo";

export async function getProfile(db: Db, userId: string): Promise<ProfileData | null> {
  const [row] = await db
    .select({
      sex: profiles.sex,
      birthDate: profiles.birthDate,
      heightCm: profiles.heightCm,
      weightKg: profiles.weightKg,
      activityLevel: profiles.activityLevel,
      goal: profiles.goal,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

// One transaction: a profile must never exist without its default target, and a manual
// target is the user's explicit choice, so a profile edit must not overwrite it.
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
    const current = await getDefaultTarget(tx, userId);
    if (current?.mode === "manual") return;
    await upsertDefaultTarget(tx, userId, calcAutoTargets(profile, today), "auto");
  });
}

export async function resetTargetToAuto(db: Db, userId: string, today: IsoDate): Promise<boolean> {
  const profile = await getProfile(db, userId);
  if (!profile) return false;
  await upsertDefaultTarget(db, userId, calcAutoTargets(profile, today), "auto");
  return true;
}
