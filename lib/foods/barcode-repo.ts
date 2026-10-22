import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { lockSharedBarcode } from "@/db/locks";
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

// Two people scanning a new pack at once both reach here; the lock makes the second one find
// the first one's row. A cached food someone soft-deleted by hand is revived, not duplicated:
// seed_key stays unique across deleted rows.
export async function saveOffFood(
  db: Db,
  code: string,
  product: { values: FoodValues; portionGrams: number | null; sourceUrl: string },
): Promise<{ id: string }> {
  const seedKey = `off:${code}`;
  return db.transaction(async (tx) => {
    await lockSharedBarcode(tx, code);
    const [existing] = await tx
      .update(foods)
      .set({ deletedAt: null, updatedAt: sql`now()` })
      .where(and(eq(foods.seedKey, seedKey), isNotNull(foods.deletedAt)))
      .returning({ id: foods.id });
    const [live] = existing
      ? [existing]
      : await tx.select({ id: foods.id }).from(foods).where(eq(foods.seedKey, seedKey));
    if (live) return { id: live.id };

    const [row] = await tx
      .insert(foods)
      .values({
        ...product.values,
        ownerId: null,
        source: "off",
        seedKey,
        barcode: code,
        sourceUrl: product.sourceUrl,
      })
      .returning({ id: foods.id });
    if (!row) throw new Error("off food insert returned no row");
    if (product.portionGrams !== null) {
      await tx.insert(foodPortions).values({
        foodId: row.id,
        userId: null,
        label: ru.foods.piecePortion,
        grams: product.portionGrams,
      });
    }
    return { id: row.id };
  });
}
