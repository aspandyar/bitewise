import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { favorites, foodPortions, foods, recipes } from "@/db/schema";
import { addEntry, deleteEntry, deleteOwnEntries, getDayEntries } from "@/lib/diary/repo";
import { setFavorite } from "@/lib/diary/quick-repo";
import { addItem, createRecipe, deleteItem, deleteRecipe, getRecipe } from "@/lib/recipes/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, newUserId } from "@/tests/foods";
import { addPortion, deleteOwnFood } from "./repo";

// Soft delete exists only to keep history readable. A deleted food nothing points at is removed
// for good, so create-and-delete loops cannot grow the tables without bound (#108).

const DAY = "2026-10-21";
const cheese = {
  name: "Сыр",
  kcal100: 350,
  protein100: 25,
  fat100: 27,
  carbs100: 0,
  fiber100: null,
};

beforeEach(resetDb);
afterAll(closeTestDb);

async function foodRow(id: string) {
  const [row] = await testDb
    .select({ id: foods.id, deletedAt: foods.deletedAt })
    .from(foods)
    .where(eq(foods.id, id));
  return row ?? null;
}

async function logged(userId: string, foodId: string) {
  const result = await addEntry(testDb, userId, {
    date: DAY,
    meal: "breakfast",
    foodId,
    amount: { mode: "grams", grams: 30 },
  });
  if (result !== "ok") throw new Error(result);
  const [entry] = await getDayEntries(testDb, userId, DAY);
  if (!entry) throw new Error("no entry");
  return entry.id;
}

async function dish(userId: string, name: string) {
  const recipe = await createRecipe(testDb, userId, { name, cookedWeightG: null, servings: null });
  if (recipe === "limit") throw new Error("recipe cap reached in a test");
  return recipe.id;
}

describe("deleting an own food", () => {
  it("removes a food nothing points at, with its portions and star", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    await addPortion(testDb, alice, id, { label: "ломтик", grams: 20 });
    await setFavorite(testDb, alice, id, true);
    expect(await deleteOwnFood(testDb, alice, id)).toBe(true);
    expect(await foodRow(id)).toBeNull();
    expect(await testDb.select().from(foodPortions).where(eq(foodPortions.foodId, id))).toEqual([]);
    expect(await testDb.select().from(favorites).where(eq(favorites.foodId, id))).toEqual([]);
  });

  it("keeps a food the diary points at, and removes it once the last entry goes", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    const entry = await logged(alice, id);
    expect(await deleteOwnFood(testDb, alice, id)).toBe(true);
    expect((await foodRow(id))?.deletedAt).not.toBeNull();
    await deleteEntry(testDb, alice, entry);
    expect(await foodRow(id)).toBeNull();
  });

  it("removes it after an undo takes back its last entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    const entry = await logged(alice, id);
    await deleteOwnFood(testDb, alice, id);
    await deleteOwnEntries(testDb, alice, [entry]);
    expect(await foodRow(id)).toBeNull();
  });

  it("keeps a food a dish still uses, and removes it with the ingredient", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    const recipeId = await dish(alice, "Бутерброд");
    await addItem(testDb, alice, recipeId, { foodId: id, amount: { mode: "grams", grams: 20 } });
    await deleteOwnFood(testDb, alice, id);
    expect((await foodRow(id))?.deletedAt).not.toBeNull();
    const recipe = await getRecipe(testDb, alice, recipeId);
    const item = recipe?.items[0];
    if (!item) throw new Error("no item");
    await deleteItem(testDb, alice, recipeId, item.id);
    expect(await foodRow(id)).toBeNull();
  });

  it("leaves a live food alone when an entry with it is deleted", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    await deleteEntry(testDb, alice, await logged(alice, id));
    expect((await foodRow(id))?.deletedAt).toBeNull();
  });
});

describe("deleting a dish", () => {
  it("removes a dish nothing points at, its food and its ingredients' deleted foods", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id: ingredient } = await createOwnFood(alice, cheese);
    const recipeId = await dish(alice, "Бутерброд");
    await addItem(testDb, alice, recipeId, {
      foodId: ingredient,
      amount: { mode: "grams", grams: 20 },
    });
    await deleteOwnFood(testDb, alice, ingredient);
    const [row] = await testDb.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(await deleteRecipe(testDb, alice, recipeId)).toBe(true);
    expect(await foodRow(row!.foodId)).toBeNull();
    expect(await testDb.select().from(recipes).where(eq(recipes.id, recipeId))).toEqual([]);
    expect(await foodRow(ingredient)).toBeNull();
  });

  it("keeps a dish the diary points at as a soft-deleted food", async () => {
    const alice = await newUserId("alice@mail.com");
    const recipeId = await dish(alice, "Бутерброд");
    const [row] = await testDb.select().from(recipes).where(eq(recipes.id, recipeId));
    await logged(alice, row!.foodId);
    await deleteRecipe(testDb, alice, recipeId);
    expect((await foodRow(row!.foodId))?.deletedAt).not.toBeNull();
  });
});

describe("other users", () => {
  it("never removes another user's deleted food", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id } = await createOwnFood(alice, cheese);
    const entry = await logged(alice, id);
    await deleteOwnFood(testDb, alice, id);
    await deleteOwnEntries(testDb, bob, [entry]);
    await deleteEntry(testDb, bob, entry);
    expect(await foodRow(id)).not.toBeNull();
  });
});
