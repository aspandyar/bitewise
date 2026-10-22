import { and, asc, eq, sql } from "drizzle-orm";
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
// the first one's row. A cached food that was deleted (its data was wrong) stays deleted and its
// code blocked: null, and a rescan cannot bring the bad row back.
export async function saveOffFood(
  db: Db,
  code: string,
  product: { values: FoodValues; portionGrams: number | null; sourceUrl: string },
): Promise<{ id: string } | null> {
  const seedKey = `off:${code}`;
  return db.transaction(async (tx) => {
    await lockSharedBarcode(tx, code);
    const [existing] = await tx
      .select({ id: foods.id, deletedAt: foods.deletedAt })
      .from(foods)
      .where(eq(foods.seedKey, seedKey));
    if (existing) return existing.deletedAt ? null : { id: existing.id };

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
