import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { foodPortions, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import { SEED_FOOD_SOURCES } from "@/lib/config";
import { recomputeRecipesEach, staleRecipesUsingSharedFoods } from "@/lib/recipes/recompute";
import type { PortionValues } from "./types";
import type { SeedFood } from "./seed-schema";

// Diary entries (stage 3) may point at shared portions, so their ids must survive re-runs:
// rows are matched by label and only changed, added or removed when the seed says so.
async function syncSharedPortions(db: Db, foodId: string, wanted: readonly PortionValues[]) {
  const existing = await db
    .select({ id: foodPortions.id, label: foodPortions.label, grams: foodPortions.grams })
    .from(foodPortions)
    .where(and(eq(foodPortions.foodId, foodId), isNull(foodPortions.userId)));
  const byLabel = new Map(existing.map((portion) => [portion.label, portion]));
  const wantedLabels = new Set(wanted.map((portion) => portion.label));

  const stale = existing.filter((portion) => !wantedLabels.has(portion.label));
  if (stale.length > 0) {
    await db.delete(foodPortions).where(
      inArray(
        foodPortions.id,
        stale.map((portion) => portion.id),
      ),
    );
  }
  for (const portion of wanted) {
    const current = byLabel.get(portion.label);
    if (!current) {
      await db.insert(foodPortions).values({ ...portion, foodId, userId: null });
    } else if (current.grams !== portion.grams) {
      await db
        .update(foodPortions)
        .set({ grams: portion.grams })
        .where(eq(foodPortions.id, current.id));
    }
  }
}

// Foods and portions in one transaction: a half-applied seed would leave foods without their
// portions. Recipes follow after the commit, each on its own (#23).
export async function loadFoodSeed(
  db: Db,
  seed: readonly SeedFood[],
): Promise<{ upserted: number; retired: number; recomputed: number; failed: number }> {
  const written = await db.transaction(async (tx) => {
    for (const { key, portions, ...values } of seed) {
      const [changed] = await tx
        .insert(foods)
        .values({ ...values, seedKey: key, ownerId: null })
        .onConflictDoUpdate({
          target: foods.seedKey,
          // Clearing deleted_at revives a food whose key came back into the seed.
          set: { ...values, deletedAt: null, updatedAt: sql`now()` },
          // Unchanged rows are skipped so updated_at keeps meaning "the data changed".
          setWhere: sql`(${foods.name}, ${foods.kcal100}, ${foods.protein100}, ${foods.fat100}, ${foods.carbs100}, ${foods.fiber100}, ${foods.source}, ${foods.sourceUrl}, ${foods.deletedAt})
            IS DISTINCT FROM (excluded.name, excluded.kcal_100, excluded.protein_100, excluded.fat_100, excluded.carbs_100, excluded.fiber_100, excluded.source, excluded.source_url, NULL::timestamptz)`,
        })
        .returning({ id: foods.id });
      // A skipped update returns no row, so the id is looked up instead.
      const [row] = changed
        ? [changed]
        : await tx.select({ id: foods.id }).from(foods).where(eq(foods.seedKey, key));
      if (!row) throw new Error(`seed upsert found no row for ${key}`);
      await syncSharedPortions(tx, row.id, portions);
    }

    const keys = seed.map((food) => food.key);
    // Soft delete: diary entries (stage 3) may still point at a food that left the seed.
    const retired = await tx
      .update(foods)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          isNotNull(foods.seedKey),
          inArray(foods.source, SEED_FOOD_SOURCES),
          isNull(foods.deletedAt),
          keys.length > 0 ? notInArray(foods.seedKey, keys) : undefined,
        ),
      )
      .returning({ id: foods.id });
    return { upserted: seed.length, retired: retired.length };
  });
  // Users' recipes made of shared foods follow the seed's corrections, including any left behind
  // by an earlier run that failed or stopped after its commit.
  const { recomputed, failed } = await recomputeRecipesEach(
    db,
    await staleRecipesUsingSharedFoods(db),
  );
  return { upserted: written.upserted, retired: written.retired, recomputed, failed };
}
