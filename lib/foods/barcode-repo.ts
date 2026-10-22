import { and, asc, eq, sql } from "drizzle-orm";
import { foodPortions, foods } from "@/db/schema";
import type { Db } from "@/db/types";
import { ru } from "@/lib/i18n/ru";
import { visibleTo } from "./repo";
import type { FoodValues } from "./types";

// Own before shared: a user who fixed a copy of a pack gets their copy from the scanner.
export async function findFoodByBarcode(
  db: Db,
  userId: string,
  code: string,
): Promise<{ id: string; isOwn: boolean } | null> {
  const [row] = await db
    .select({ id: foods.id, isOwn: sql<boolean>`${foods.ownerId} IS NOT NULL` })
    .from(foods)
    .where(and(eq(foods.barcode, code), visibleTo(userId)))
    .orderBy(asc(sql`${foods.ownerId} IS NULL`))
    .limit(1);
  return row ?? null;
}

// Two people scanning a new pack at once both reach here. The upsert on seed_key settles it:
// one insert wins, the other updates the same row, and only the insert adds the portion. It also
// revives a cached food someone soft-deleted by hand instead of failing on its key.
export async function saveOffFood(
  db: Db,
  code: string,
  product: { values: FoodValues; portionGrams: number | null; sourceUrl: string },
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(foods)
      .values({
        ...product.values,
        ownerId: null,
        source: "off",
        seedKey: `off:${code}`,
        barcode: code,
        sourceUrl: product.sourceUrl,
      })
      .onConflictDoUpdate({
        target: foods.seedKey,
        set: { deletedAt: null, updatedAt: sql`now()` },
      })
      // xmax is 0 only on a row this statement inserted.
      .returning({ id: foods.id, inserted: sql<boolean>`xmax = 0` });
    if (!row) throw new Error("off food upsert returned no row");
    if (row.inserted && product.portionGrams !== null) {
      await tx
        .insert(foodPortions)
        .values({ foodId: row.id, userId: null, label: ru.foods.piecePortion, grams: product.portionGrams });
    }
    return { id: row.id };
  });
}
