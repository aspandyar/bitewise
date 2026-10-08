import { and, eq, sql } from "drizzle-orm";
import { targets } from "@/db/schema";
import type { Db } from "@/db/types";
import type { TargetMode } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import type { MacroTargets } from "@/lib/nutrition";

export type DefaultTarget = MacroTargets & { mode: TargetMode };

export async function getDefaultTarget(db: Db, userId: string): Promise<DefaultTarget | null> {
  const [row] = await db
    .select({
      mode: targets.mode,
      kcal: targets.kcal,
      proteinG: targets.proteinG,
      fatG: targets.fatG,
      carbsG: targets.carbsG,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.isDefault, true)))
    .limit(1);
  return row ?? null;
}

// Relies on the partial unique index (user_id) WHERE is_default as the conflict target.
export async function upsertDefaultTarget(
  db: Db,
  userId: string,
  values: MacroTargets,
  mode: TargetMode,
): Promise<void> {
  await db
    .insert(targets)
    .values({ userId, name: ru.targets.defaultName, isDefault: true, mode, ...values })
    .onConflictDoUpdate({
      target: targets.userId,
      targetWhere: sql`${targets.isDefault}`,
      set: { mode, ...values, updatedAt: sql`now()` },
    });
}

export async function setManualTarget(db: Db, userId: string, values: MacroTargets): Promise<void> {
  await upsertDefaultTarget(db, userId, values, "manual");
}
