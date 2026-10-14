import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { foods, recipeItems, recipes, users } from "@/db/schema";
import { FOOD_LIMITS } from "@/lib/config";
import { addEntry, getDayEntries } from "@/lib/diary/repo";
import {
  getVisibleFood,
  listVisiblePortions,
  softDeleteOwnFood,
  updateOwnFood,
} from "@/lib/foods/repo";
import { calcEntryNutrients } from "@/lib/nutrition";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, insertSharedFood, insertSharedPortion, newUserId } from "@/tests/foods";
import {
  addItem,
  createRecipe,
  deleteItem,
  deleteRecipe,
  getRecipe,
  getRecipeIdByFoodId,
  lastRecipeChange,
  listRecipes,
  updateItem,
  updateRecipe,
} from "./repo";
import type { RecipeValues } from "./types";

const buckwheat = { name: "Гречка", kcal100: 343, protein100: 13, fat100: 3.4, carbs100: 62 };
const oil = { name: "Масло", kcal100: 899, protein100: 0, fat100: 99.9, carbs100: 0 };
const porridge = { name: "Каша", cookedWeightG: 500, servings: 4 };

beforeEach(resetDb);
afterAll(closeTestDb);

async function newRecipe(userId: string, values: RecipeValues = porridge): Promise<string> {
  const created = await createRecipe(testDb, userId, values);
  if (created === "limit") throw new Error("recipe cap reached in a test");
  return created.id;
}

async function recipeFood(userId: string, recipeId: string) {
  const recipe = await getRecipe(testDb, userId, recipeId);
  if (!recipe) throw new Error("no recipe");
  const food = await getVisibleFood(testDb, userId, recipe.foodId);
  if (!food) throw new Error("no recipe food");
  return { recipe, food, portions: await listVisiblePortions(testDb, userId, recipe.foodId) };
}

async function grams(userId: string, recipeId: string, foodId: string, value: number) {
  return addItem(testDb, userId, recipeId, { foodId, amount: { mode: "grams", grams: value } });
}

describe("createRecipe", () => {
  it("creates a recipe food that search and the diary can use", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice);
    const { recipe, food } = await recipeFood(alice, id);
    expect(recipe).toMatchObject({ name: "Каша", cookedWeightG: 500, servings: 4, items: [] });
    expect(food).toMatchObject({
      name: "Каша",
      kcal100: 0,
      isOwn: true,
      isRecipe: true,
      source: "user",
    });
    expect(await getRecipeIdByFoodId(testDb, alice, recipe.foodId)).toBe(id);
    expect(await lastRecipeChange(testDb, alice)).toBeInstanceOf(Date);
  });

  it("counts toward the own food cap", async () => {
    const alice = await newUserId("alice@mail.com");
    await testDb.insert(foods).values(
      Array.from({ length: FOOD_LIMITS.maxOwnFoods }, (_, index) => ({
        name: `Продукт ${index}`,
        kcal100: 1,
        protein100: 0,
        fat100: 0,
        carbs100: 0,
        source: "user" as const,
        ownerId: alice,
      })),
    );
    expect(await createRecipe(testDb, alice, porridge)).toBe("limit");
  });
});

describe("recipe numbers", () => {
  it("recomputes the food row and the serving portion on every change", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice);
    const buckwheatId = await insertSharedFood(buckwheat);
    const oilId = await insertSharedFood(oil);
    expect(await grams(alice, id, buckwheatId, 200)).toBe("ok");
    expect(await grams(alice, id, oilId, 10)).toBe("ok");

    let { food, portions } = await recipeFood(alice, id);
    // 775.9 kcal / 500 g × 100; stored with two decimals.
    expect(food).toMatchObject({ kcal100: 155.18, protein100: 5.2, fat100: 3.36, carbs100: 24.8 });
    expect(portions.map(({ label, grams: g }) => [label, g])).toEqual([["1 порция", 125]]);

    expect(
      await updateRecipe(testDb, alice, id, { name: "Каша!", cookedWeightG: null, servings: 2 }),
    ).toBe("ok");
    ({ food, portions } = await recipeFood(alice, id));
    // Raw weight 210 g: 775.9 / 210 × 100 = 369.476…
    expect(food).toMatchObject({ name: "Каша!", kcal100: 369.48 });
    expect(portions.map((p) => p.grams)).toEqual([105]);

    await updateRecipe(testDb, alice, id, { name: "Каша!", cookedWeightG: null, servings: null });
    expect((await recipeFood(alice, id)).portions).toEqual([]);
  });

  it("adds an ingredient by portion with a snapshot", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Омлет", cookedWeightG: null, servings: null });
    const eggId = await insertSharedFood({ name: "Яйцо", kcal100: 157 });
    const portionId = await insertSharedPortion(eggId, "1 шт", 60);
    const result = await addItem(testDb, alice, id, {
      foodId: eggId,
      amount: { mode: "portion", portionId, count: 2 },
    });
    expect(result).toBe("ok");
    const { recipe, food } = await recipeFood(alice, id);
    expect(recipe.items).toEqual([
      expect.objectContaining({
        foodName: "Яйцо",
        foodDeleted: false,
        grams: 120,
        portionLabel: "1 шт",
        portionGrams: 60,
        portionCount: 2,
      }),
    ]);
    expect(food.kcal100).toBe(157);
  });

  it("updates and deletes ingredients and recomputes", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Омлет", cookedWeightG: null, servings: null });
    const eggId = await insertSharedFood({ name: "Яйцо", kcal100: 157 });
    const oilId = await insertSharedFood(oil);
    const portionId = await insertSharedPortion(eggId, "1 шт", 60);
    await addItem(testDb, alice, id, {
      foodId: eggId,
      amount: { mode: "portion", portionId, count: 2 },
    });
    await grams(alice, id, oilId, 10);
    const [egg, oilItem] = (await recipeFood(alice, id)).recipe.items;
    if (!egg || !oilItem) throw new Error("items missing");

    expect(await updateItem(testDb, alice, id, egg.id, { mode: "portion", count: 3 })).toBe("ok");
    expect(await updateItem(testDb, alice, id, oilItem.id, { mode: "portion", count: 1 })).toBe(
      "not_found",
    );
    // Eggs 180 g (282.6 kcal) + oil 10 g (89.9 kcal) = 372.5 kcal / 190 g.
    expect((await recipeFood(alice, id)).food.kcal100).toBe(196.05);

    expect(await updateItem(testDb, alice, id, egg.id, { mode: "grams", grams: 100 })).toBe("ok");
    const updated = (await recipeFood(alice, id)).recipe.items[0];
    expect(updated).toMatchObject({ grams: 100, portionLabel: null, portionCount: null });

    expect(await deleteItem(testDb, alice, id, oilItem.id)).toBe(true);
    expect(await deleteItem(testDb, alice, id, oilItem.id)).toBe(false);
    expect((await recipeFood(alice, id)).food.kcal100).toBe(157);
  });

  it("skips a serving too small to store", async () => {
    const alice = await newUserId("alice@mail.com");
    // 0.1 g / 100 servings = 0.001 g, which numeric(8,2) would store as 0.
    const id = await newRecipe(alice, { name: "Щепотка", cookedWeightG: 0.1, servings: 100 });
    expect((await recipeFood(alice, id)).portions).toEqual([]);
  });

  it("skips a serving heavier than any portion", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Кастрюля", cookedWeightG: 20_000, servings: 1 });
    expect((await recipeFood(alice, id)).portions).toEqual([]);
  });

  it("keeps a deleted ingredient counting and marks it", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Суп", cookedWeightG: null, servings: null });
    const own = await createOwnFood(alice, { ...buckwheat, name: "Моя гречка", fiber100: null });
    await grams(alice, id, own.id, 100);
    expect(await softDeleteOwnFood(testDb, alice, own.id)).toBe(true);
    const { recipe, food } = await recipeFood(alice, id);
    expect(recipe.items[0]).toMatchObject({ foodName: "Моя гречка", foodDeleted: true });
    expect(food.kcal100).toBe(343);
  });
});

describe("recipe guards", () => {
  it("rejects recipes, deleted and foreign foods and foreign portions as ingredients", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const id = await newRecipe(alice);
    const other = await newRecipe(alice, { name: "Соус", cookedWeightG: null, servings: null });
    const otherFood = (await recipeFood(alice, other)).recipe.foodId;
    const bobsFood = await createOwnFood(bob, { ...buckwheat, name: "Боба", fiber100: null });
    const deleted = await createOwnFood(alice, { ...buckwheat, name: "Старая", fiber100: null });
    await softDeleteOwnFood(testDb, alice, deleted.id);
    const eggId = await insertSharedFood({ name: "Яйцо" });
    const milkId = await insertSharedFood({ name: "Молоко" });
    const milkPortion = await insertSharedPortion(milkId, "1 стакан", 200);

    expect(await grams(alice, id, otherFood, 100)).toBe("not_found");
    expect(await grams(alice, id, bobsFood.id, 100)).toBe("not_found");
    expect(await grams(alice, id, deleted.id, 100)).toBe("not_found");
    expect(
      await addItem(testDb, alice, id, {
        foodId: eggId,
        amount: { mode: "portion", portionId: milkPortion, count: 1 },
      }),
    ).toBe("not_found");
  });

  it("refuses an ingredient whose portion amount leaves the grams range", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Суп", cookedWeightG: null, servings: null });
    const eggId = await insertSharedFood({ name: "Яйцо" });
    const pot = await insertSharedPortion(eggId, "кастрюля", 5000);
    expect(
      await addItem(testDb, alice, id, {
        foodId: eggId,
        amount: { mode: "portion", portionId: pot, count: 2 },
      }),
    ).toBe("grams_out_of_range");

    await addItem(testDb, alice, id, {
      foodId: eggId,
      amount: { mode: "portion", portionId: pot, count: 1 },
    });
    const itemId = (await recipeFood(alice, id)).recipe.items[0]?.id ?? "";
    expect(await updateItem(testDb, alice, id, itemId, { mode: "portion", count: 2 })).toBe(
      "grams_out_of_range",
    );
  });

  it("hides a recipe from another user", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const id = await newRecipe(alice);
    const eggId = await insertSharedFood({ name: "Яйцо" });
    await grams(alice, id, eggId, 100);
    const itemId = (await recipeFood(alice, id)).recipe.items[0]?.id ?? "";

    expect(await getRecipe(testDb, bob, id)).toBeNull();
    expect(await listRecipes(testDb, bob)).toEqual([]);
    expect(await grams(bob, id, eggId, 100)).toBe("not_found");
    expect(await updateRecipe(testDb, bob, id, porridge)).toBe("not_found");
    expect(await updateItem(testDb, bob, id, itemId, { mode: "grams", grams: 1 })).toBe(
      "not_found",
    );
    expect(await deleteItem(testDb, bob, id, itemId)).toBe(false);
    expect(await deleteRecipe(testDb, bob, id)).toBe(false);
    expect(
      await getRecipeIdByFoodId(testDb, bob, (await recipeFood(alice, id)).recipe.foodId),
    ).toBeNull();
  });

  it("caps the number of ingredients", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice);
    const eggId = await insertSharedFood({ name: "Яйцо" });
    const add = () =>
      addItem(
        testDb,
        alice,
        id,
        { foodId: eggId, amount: { mode: "grams", grams: 10 } },
        { maxItems: 2 },
      );
    expect(await add()).toBe("ok");
    expect(await add()).toBe("ok");
    expect(await add()).toBe("limit");
  });

  it("refuses a cooked weight below what the composition weighs", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Каша", cookedWeightG: 100, servings: null });
    const buckwheatId = await insertSharedFood(buckwheat);
    // 200 g of buckwheat hold 156.8 g of protein, fat and carbs: more than 100 g.
    expect(await grams(alice, id, buckwheatId, 200)).toBe("weight_too_low");
    expect(await grams(alice, id, buckwheatId, 100)).toBe("ok");
    expect(
      await updateRecipe(testDb, alice, id, { name: "Каша", cookedWeightG: 50, servings: null }),
    ).toBe("weight_too_low");
    expect(
      await updateRecipe(testDb, alice, id, { name: "Каша", cookedWeightG: null, servings: null }),
    ).toBe("ok");
    const item = (await recipeFood(alice, id)).recipe.items[0];
    if (!item) throw new Error("no item");
    await updateRecipe(testDb, alice, id, { name: "Каша", cookedWeightG: 100, servings: null });
    expect(await updateItem(testDb, alice, id, item.id, { mode: "grams", grams: 200 })).toBe(
      "weight_too_low",
    );
  });
});

describe("listRecipes and deleteRecipe", () => {
  it("lists live recipes with their serving, newest first", async () => {
    const alice = await newUserId("alice@mail.com");
    await newRecipe(alice, { name: "Первое", cookedWeightG: 400, servings: 2 });
    const second = await newRecipe(alice, { name: "Второе", cookedWeightG: null, servings: null });
    expect((await listRecipes(testDb, alice)).map((r) => [r.name, r.servingGrams])).toEqual([
      ["Второе", null],
      ["Первое", 200],
    ]);
    expect(await deleteRecipe(testDb, alice, second)).toBe(true);
    expect((await listRecipes(testDb, alice)).map((r) => r.name)).toEqual(["Первое"]);
    expect(await getRecipe(testDb, alice, second)).toBeNull();
  });

  it("drops a deleted recipe's ingredients and stops recomputing it", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Суп", cookedWeightG: null, servings: null });
    const beet = { name: "Моя свёкла", kcal100: 40, protein100: 1, fat100: 0, carbs100: 9 };
    const own = await createOwnFood(alice, { ...beet, fiber100: null });
    await grams(alice, id, own.id, 100);
    const { foodId } = (await recipeFood(alice, id)).recipe;
    expect(await deleteRecipe(testDb, alice, id)).toBe(true);
    expect(await testDb.select().from(recipeItems)).toEqual([]);

    await updateOwnFood(testDb, alice, own.id, { ...beet, kcal100: 90, fiber100: null });
    const [food] = await testDb
      .select({ kcal100: foods.kcal100 })
      .from(foods)
      .where(eq(foods.id, foodId));
    expect(food?.kcal100).toBe(40);
  });

  it("keeps diary entries of a deleted recipe", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice);
    const { recipe } = await recipeFood(alice, id);
    await addEntry(testDb, alice, {
      date: "2026-10-12",
      meal: "lunch",
      foodId: recipe.foodId,
      amount: { mode: "grams", grams: 100 },
    });
    await deleteRecipe(testDb, alice, id);
    expect(await getDayEntries(testDb, alice, "2026-10-12")).toHaveLength(1);
  });

  it("goes away with its user even when built from the user's own foods", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice);
    const own = await createOwnFood(alice, { ...buckwheat, name: "Моя гречка", fiber100: null });
    await grams(alice, id, own.id, 100);
    await testDb.delete(users).where(eq(users.id, alice));
    expect(await testDb.select().from(recipes)).toEqual([]);
    expect(await testDb.select().from(recipeItems)).toEqual([]);
  });
});

describe("borscht", () => {
  it("adds a dish of 8 ingredients to the diary as one portion", async () => {
    const alice = await newUserId("alice@mail.com");
    const id = await newRecipe(alice, { name: "Борщ", cookedWeightG: 3000, servings: 10 });
    const shared = async (
      name: string,
      kcal100: number,
      protein100: number,
      fat100: number,
      carbs100: number,
    ) => insertSharedFood({ name, kcal100, protein100, fat100, carbs100 });
    const beet = await shared("Свёкла", 43, 1.6, 0.2, 9.6);
    const cabbage = await shared("Капуста", 25, 1.3, 0.1, 5.8);
    const potato = await shared("Картофель", 77, 2, 0.1, 17);
    const carrot = await shared("Морковь", 41, 0.9, 0.2, 9.6);
    const onion = await shared("Лук", 40, 1.1, 0.1, 9.3);
    const beef = await shared("Говядина", 187, 18.9, 12.4, 0);
    const paste = await shared("Томатная паста", 82, 4.3, 0.5, 16.7);
    const sunflower = await shared("Масло подсолнечное", 899, 0, 99.9, 0);
    const onionPiece = await insertSharedPortion(onion, "1 шт", 100);
    const spoon = await insertSharedPortion(paste, "1 ст. л.", 30);

    for (const [foodId, value] of [
      [beet, 300],
      [cabbage, 400],
      [potato, 500],
      [carrot, 150],
      [beef, 500],
      [sunflower, 20],
    ] as const) {
      expect(await grams(alice, id, foodId, value)).toBe("ok");
    }
    const byPortion = (foodId: string, portionId: string, count: number) =>
      addItem(testDb, alice, id, { foodId, amount: { mode: "portion", portionId, count } });
    expect(await byPortion(onion, onionPiece, 1)).toBe("ok");
    expect(await byPortion(paste, spoon, 2)).toBe("ok");

    // 129 + 100 + 385 + 61.5 + 935 + 179.8 + 40 + 49.2 = 1879.5 kcal in 3000 g.
    const { recipe, food, portions } = await recipeFood(alice, id);
    expect(recipe.items).toHaveLength(8);
    expect(food.kcal100).toBe(62.65);
    const [serving] = portions;
    expect(serving).toMatchObject({ label: "1 порция", grams: 300 });
    if (!serving) throw new Error("no serving");

    expect(
      await addEntry(testDb, alice, {
        date: "2026-10-12",
        meal: "lunch",
        foodId: recipe.foodId,
        amount: { mode: "portion", portionId: serving.id, count: 1 },
      }),
    ).toBe("ok");
    const [entry] = await getDayEntries(testDb, alice, "2026-10-12");
    expect(entry).toMatchObject({
      foodName: "Борщ",
      kcal100: 62.65,
      grams: 300,
      portionLabel: "1 порция",
      portionCount: 1,
    });
    if (!entry) throw new Error("no entry");
    expect(calcEntryNutrients(entry, entry.grams).kcal).toBeCloseTo(187.95, 6);
  });
});
