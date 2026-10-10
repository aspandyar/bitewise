import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { foods } from "@/db/schema";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
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

describe("loadFoodSeed", () => {
  it("inserts shared foods with their portions", async () => {
    const alice = await newUserId("alice@mail.com");
    expect(await loadFoodSeed(testDb, [buckwheat, ryazhenka])).toEqual({
      upserted: 2,
      retired: 0,
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
    if (!copy) throw new Error("no copy");

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

    expect(await loadFoodSeed(testDb, [buckwheat])).toEqual({ upserted: 1, retired: 1 });
    expect(await getVisibleFood(testDb, alice, id)).toBeNull();

    await loadFoodSeed(testDb, [buckwheat, ryazhenka]);
    expect(await getVisibleFood(testDb, alice, id)).not.toBeNull();
  });

  it("never retires users' own foods", async () => {
    const alice = await newUserId("alice@mail.com");
    await loadFoodSeed(testDb, [buckwheat]);
    const copy = await copyFood(testDb, alice, await idOf("usda:170286"));
    if (!copy) throw new Error("no copy");
    expect((await loadFoodSeed(testDb, [])).retired).toBe(1);
    expect(await getVisibleFood(testDb, alice, copy.id)).not.toBeNull();
  });
});
