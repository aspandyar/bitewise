import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { foodPortions, foods } from "@/db/schema";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { recomputeRecipe, recomputeRecipesEach } from "@/lib/recipes/recompute";
import { addItem, createRecipe, getRecipe } from "@/lib/recipes/repo";
import { newUserId } from "@/tests/foods";
import { addPortion, copyFood, getVisibleFood, listVisiblePortions } from "./repo";
import { loadFoodSeed } from "./seed";
import type { SeedFood } from "./seed-schema";

const buckwheat: SeedFood = {
  key: "usda:170286",
  name: "Гречка, крупа сухая",
  source: "usda",
  kcal100: 343,
  protein100: 13.25,
  fat100: 3.4,
  carbs100: 61.5,
  fiber100: 10,
  sourceUrl: null,
  portions: [{ label: "1 ст. л.", grams: 12 }],
};
const ryazhenka: SeedFood = {
  key: "label:ryazhenka-4",
  name: "Ряженка 4 %",
  source: "label",
  kcal100: 67,
  protein100: 2.8,
  fat100: 4,
  carbs100: 4.2,
  fiber100: null,
  sourceUrl: "https://example.com/ryazhenka",
  portions: [],
};

async function idOf(key: string): Promise<string> {
  const [row] = await testDb.select({ id: foods.id }).from(foods).where(eq(foods.seedKey, key));
  if (!row) throw new Error(`no food ${key}`);
  return row.id;
}

beforeEach(resetDb);
afterAll(closeTestDb);

async function snapshot(key: string) {
  const id = await idOf(key);
  const [food] = await testDb
    .select({ updatedAt: foods.updatedAt })
    .from(foods)
    .where(eq(foods.id, id));
  const portions = await testDb
    .select({ id: foodPortions.id, label: foodPortions.label, grams: foodPortions.grams })
    .from(foodPortions)
    .where(eq(foodPortions.foodId, id))
    .orderBy(foodPortions.label);
  return { updatedAt: food?.updatedAt, portions };
}

describe("loadFoodSeed", () => {
  it("inserts shared foods with their portions", async () => {
    const alice = await newUserId("alice@mail.com");
    expect(await loadFoodSeed(testDb, [buckwheat, ryazhenka])).toEqual({
      upserted: 2,
      retired: 0,
      recomputed: 0,
      failed: 0,
    });
    const id = await idOf("usda:170286");
    expect(await getVisibleFood(testDb, alice, id)).toMatchObject({
      name: "Гречка, крупа сухая",
      carbs100: 61.5,
      isOwn: false,
    });
    expect((await listVisiblePortions(testDb, alice, id)).map((p) => [p.label, p.grams])).toEqual([
      ["1 ст. л.", 12],
    ]);
  });

  it("is idempotent: a second run keeps one row per key, the same id and the same portions", async () => {
    await loadFoodSeed(testDb, [buckwheat]);
    const id = await idOf("usda:170286");
    await loadFoodSeed(testDb, [buckwheat]);
    expect(await idOf("usda:170286")).toBe(id);
    expect(await testDb.select().from(foods)).toHaveLength(1);
    const alice = await newUserId("alice@mail.com");
    expect(await listVisiblePortions(testDb, alice, id)).toHaveLength(1);
  });

  it("leaves rows untouched on a re-run with the same data, so portion ids stay stable", async () => {
    const seeded = {
      ...buckwheat,
      portions: [...buckwheat.portions, { label: "1 стакан", grams: 165 }],
    };
    await loadFoodSeed(testDb, [seeded]);
    const before = await snapshot("usda:170286");
    await loadFoodSeed(testDb, [seeded]);
    expect(await snapshot("usda:170286")).toEqual(before);
  });

  it("keeps the id of a shared portion whose grams change", async () => {
    await loadFoodSeed(testDb, [buckwheat]);
    const [before] = (await snapshot("usda:170286")).portions;
    await loadFoodSeed(testDb, [{ ...buckwheat, portions: [{ label: "1 ст. л.", grams: 13 }] }]);
    expect((await snapshot("usda:170286")).portions).toEqual([{ ...before, grams: 13 }]);
  });

  it("updates values and replaces shared portions when the seed changes", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    await loadFoodSeed(testDb, [
      { ...buckwheat, kcal100: 330, portions: [{ label: "1 стакан", grams: 165 }] },
    ]);
    const id = await idOf("usda:170286");
    expect((await getVisibleFood(testDb, alice, id))?.kcal100).toBe(330);
    expect((await listVisiblePortions(testDb, alice, id)).map((p) => p.label)).toEqual([
      "1 стакан",
    ]);
  });

  it("keeps users' personal portions and copies across re-runs", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    const id = await idOf("usda:170286");
    await addPortion(testDb, alice, id, { label: "моя тарелка", grams: 250 });
    const copy = await copyFood(testDb, alice, id);
    if (!copy || copy === "limit") throw new Error("no copy");

    await loadFoodSeed(testDb, [{ ...buckwheat, portions: [] }]);

    expect((await listVisiblePortions(testDb, alice, id)).map((p) => p.label)).toEqual([
      "моя тарелка",
    ]);
    expect(await getVisibleFood(testDb, alice, copy.id)).not.toBeNull();
  });

  it("soft-deletes foods whose key left the seed and revives them when it returns", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat, ryazhenka]);
    const id = await idOf("label:ryazhenka-4");

    expect(await loadFoodSeed(testDb, [buckwheat])).toEqual({
      upserted: 1,
      retired: 1,
      recomputed: 0,
      failed: 0,
    });
    expect(await getVisibleFood(testDb, alice, id)).toBeNull();

    await loadFoodSeed(testDb, [buckwheat, ryazhenka]);
    expect(await getVisibleFood(testDb, alice, id)).not.toBeNull();
  });

  it("never retires users' own foods", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    const copy = await copyFood(testDb, alice, await idOf("usda:170286"));
    if (!copy || copy === "limit") throw new Error("no copy");
    expect((await loadFoodSeed(testDb, [])).retired).toBe(1);
    expect(await getVisibleFood(testDb, alice, copy.id)).not.toBeNull();
  });
});

describe("loadFoodSeed and recipes", () => {
  it("recomputes a user's recipe when a shared ingredient changes", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    const created = await createRecipe(testDb, alice, {
      name: "Каша",
      cookedWeightG: null,
      servings: null,
    });
    if (created === "limit") throw new Error("cap");
    await addItem(testDb, alice, created.id, {
      foodId: await idOf(buckwheat.key),
      amount: { mode: "grams", grams: 100 },
    });

    const result = await loadFoodSeed(testDb, [{ ...buckwheat, kcal100: 350 }]);
    const recipe = await getRecipe(testDb, alice, created.id);
    const food = recipe && (await getVisibleFood(testDb, alice, recipe.foodId));
    expect(food?.kcal100).toBe(350);
    expect(result).toMatchObject({ recomputed: 1, failed: 0 });
  });

  it("one failing recipe does not undo the seed or the other recipes", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    const buckwheatId = await idOf(buckwheat.key);
    const recipeIds: string[] = [];
    for (const name of ["Каша", "Гарнир"]) {
      const created = await createRecipe(testDb, alice, { name, cookedWeightG: null, servings: null });
      if (created === "limit") throw new Error("cap");
      await addItem(testDb, alice, created.id, {
        foodId: buckwheatId,
        amount: { mode: "grams", grams: 100 },
      });
      recipeIds.push(created.id);
    }
    await loadFoodSeed(testDb, [{ ...buckwheat, kcal100: 350 }]);
    await testDb.update(foods).set({ kcal100: 1 }).where(eq(foods.ownerId, alice));

    const failing = recipeIds[0];
    const result = await recomputeRecipesEach(testDb, [buckwheatId], (tx, id) =>
      id === failing ? Promise.reject(new Error("boom")) : recomputeRecipe(tx, id),
    );

    expect(result).toEqual({ recomputed: 1, failed: 1 });
    const kcal = await Promise.all(
      recipeIds.map(async (id) => {
        const recipe = await getRecipe(testDb, alice, id);
        return recipe && (await getVisibleFood(testDb, alice, recipe.foodId))?.kcal100;
      }),
    );
    expect(kcal).toEqual([1, 350]);
  });
});
