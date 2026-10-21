import { and, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import { diaryEntries, foods, recipeItems } from "@/db/schema";
import type { Db } from "@/db/types";

const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ("code" in current && current.code === FOREIGN_KEY_VIOLATION) return true;
  }
  return false;
}

// Soft delete exists only so diary history and dishes keep pointing at a food. Once the last
// entry or ingredient that used a deleted food is gone, the row goes for good (#108): otherwise a
// create-and-delete loop grows foods, recipes and their indexes without bound. Portions, stars
// and a dish's recipe row follow through their cascades. Runs inside the caller's transaction.
export async function purgeDeletedFoods(
  tx: Db,
  userId: string,
  candidates: readonly (string | null)[],
): Promise<void> {
  const ids = [...new Set(candidates.filter((id): id is string => id !== null))];
  if (ids.length === 0) return;
  try {
    // A savepoint: an entry committed in between makes the foreign key refuse, and the soft
    // delete stays as it was.
    await tx.transaction(async (savepoint) => {
      await savepoint.delete(foods).where(
        and(
          inArray(foods.id, ids),
          eq(foods.ownerId, userId),
          isNotNull(foods.deletedAt),
          notExists(
            savepoint
              .select({ one: sql`1` })
              .from(diaryEntries)
              .where(eq(diaryEntries.foodId, foods.id)),
          ),
          notExists(
            savepoint
              .select({ one: sql`1` })
              .from(recipeItems)
              .where(and(eq(recipeItems.userId, userId), eq(recipeItems.foodId, foods.id))),
          ),
        ),
      );
    });
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
  }
}
