import { and, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { foodPortions, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import type { SeedFood } from "./seed-schema";

// One transaction: a half-applied seed would leave foods without their portions.
export async function loadFoodSeed(
  db: Db,
  seed: readonly SeedFood[],
): Promise<{ upserted: number; retired: number }> {
  return db.transaction(async (tx) => {
    for (const { key, portions, ...values } of seed) {
      const [row] = await tx
        .insert(foods)
        .values({ ...values, seedKey: key, ownerId: null })
        .onConflictDoUpdate({
          target: foods.seedKey,
          // Clearing deleted_at revives a food whose key came back into the seed.
          set: { ...values, deletedAt: null, updatedAt: sql`now()` },
        })
        .returning({ id: foods.id });
      if (!row) throw new Error(`seed upsert returned no row for ${key}`);
      // Only shared portions are replaced; users' personal portions on this food stay.
      await tx
        .delete(foodPortions)
        .where(and(eq(foodPortions.foodId, row.id), isNull(foodPortions.userId)));
      if (portions.length > 0) {
        await tx
          .insert(foodPortions)
          .values(portions.map((portion) => ({ ...portion, foodId: row.id, userId: null })));
      }
    }

    const keys = seed.map((food) => food.key);
    // Soft delete: diary entries (stage 3) may still point at a food that left the seed.
    const retired = await tx
      .update(foods)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          isNotNull(foods.seedKey),
          isNull(foods.deletedAt),
          keys.length > 0 ? notInArray(foods.seedKey, keys) : undefined,
        ),
      )
      .returning({ id: foods.id });
    return { upserted: seed.length, retired: retired.length };
  });
}
