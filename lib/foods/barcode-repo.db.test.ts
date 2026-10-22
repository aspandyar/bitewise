import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { foodPortions, foods } from "@/db/schema";
import { closeTestDb, createTestPool, resetDb, testDb } from "@/tests/db";
import { newUserId } from "@/tests/foods";
import { findFoodByBarcode, saveOffFood } from "./barcode-repo";
import type { FoodValues } from "./types";

const CODE = "4610169567113";
const bar: FoodValues = {
  name: "Батончик (Bombbar)",
  kcal100: 288.33,
  protein100: 33.33,
  fat100: 7.17,
  carbs100: 5.83,
  fiber100: 33.33,
};
const offBar = {
  values: bar,
  portionGrams: 60,
  sourceUrl: `https://world.openfoodfacts.org/product/${CODE}`,
};

async function insertOwnWithBarcode(ownerId: string, barcode: string, deleted = false) {
  const [row] = await testDb
    .insert(foods)
    .values({ ...bar, ownerId, source: "user", barcode, deletedAt: deleted ? new Date() : null })
    .returning({ id: foods.id });
  return row!.id;
}

beforeEach(resetDb);
afterAll(closeTestDb);

describe("findFoodByBarcode", () => {
  it("finds the user's own food before a shared one with the same code", async () => {
    const alice = await newUserId("alice@mail.com");
    const shared = await saveOffFood(testDb, CODE, offBar);
    const own = await insertOwnWithBarcode(alice, CODE);

    expect(await findFoodByBarcode(testDb, alice, CODE)).toEqual({ id: own, isOwn: true });
    const bob = await newUserId("bob@mail.com");
    expect(await findFoodByBarcode(testDb, bob, CODE)).toEqual({ id: shared?.id, isOwn: false });
  });

  it("never finds someone else's own food or a deleted one", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    await insertOwnWithBarcode(bob, CODE);
    await insertOwnWithBarcode(alice, "96385074", true);

    expect(await findFoodByBarcode(testDb, alice, CODE)).toBeNull();
    expect(await findFoodByBarcode(testDb, alice, "96385074")).toBeNull();
  });
});

describe("saveOffFood", () => {
  it("stores a shared Open Food Facts food with its code, link and a piece portion", async () => {
    const { id } = (await saveOffFood(testDb, CODE, offBar))!;
    const [row] = await testDb.select().from(foods).where(eq(foods.id, id));
    expect(row).toMatchObject({
      ownerId: null,
      source: "off",
      seedKey: `off:${CODE}`,
      barcode: CODE,
      sourceUrl: offBar.sourceUrl,
      name: bar.name,
      kcal100: bar.kcal100,
    });
    const portions = await testDb.select().from(foodPortions).where(eq(foodPortions.foodId, id));
    expect(portions).toMatchObject([{ userId: null, label: "1 шт", grams: 60 }]);
  });

  it("adds no portion without a serving weight", async () => {
    const { id } = (await saveOffFood(testDb, CODE, { ...offBar, portionGrams: null }))!;
    expect(await testDb.select().from(foodPortions).where(eq(foodPortions.foodId, id))).toEqual([]);
  });

  it("keeps one row and one portion when the same code is saved twice", async () => {
    const first = await saveOffFood(testDb, CODE, offBar);
    const second = await saveOffFood(testDb, CODE, offBar);
    expect(second?.id).toBe(first?.id);
    expect(await testDb.select().from(foods)).toHaveLength(1);
    expect(await testDb.select().from(foodPortions)).toHaveLength(1);
  });

  it("keeps a cached food that was deleted deleted: the code stays blocked", async () => {
    const first = await saveOffFood(testDb, CODE, offBar);
    if (!first) throw new Error("not saved");
    await testDb.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, first.id));
    expect(await saveOffFood(testDb, CODE, offBar)).toBeNull();
    expect((await testDb.select().from(foods))[0]?.deletedAt).not.toBeNull();
    expect(await testDb.select().from(foods)).toHaveLength(1);
  });

  it("keeps one row and one portion when two scans of a new code race", async () => {
    const parallelCount = 5;
    const pool = createTestPool(parallelCount);
    try {
      const results = await Promise.all(
        Array.from({ length: parallelCount }, () => saveOffFood(pool.db, CODE, offBar)),
      );
      expect(new Set(results.map((result) => result?.id)).size).toBe(1);
    } finally {
      await pool.close();
    }
    expect(await testDb.select().from(foods)).toHaveLength(1);
    expect(await testDb.select().from(foodPortions)).toHaveLength(1);
  });
});
