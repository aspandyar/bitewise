import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { diaryEntries, favorites } from "@/db/schema";
import { deleteOwnFood, updateOwnFood } from "@/lib/foods/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, insertSharedFood, insertSharedPortion, newUserId } from "@/tests/foods";
import { addEntry } from "./repo";
import { findRepeatSource, listFavoriteFoods, listRecentFoods } from "./quick-repo";

const DAY = "2026-10-14";
const NEXT = "2026-10-15";
const oats = { name: "Овсянка", kcal100: 350, protein100: 12, fat100: 6, carbs100: 60 };

beforeEach(resetDb);
afterAll(closeTestDb);

async function grams(
  userId: string,
  foodId: string,
  meal: "breakfast" | "lunch" | "dinner" | "snack",
  value: number,
  date = DAY,
) {
  const result = await addEntry(testDb, userId, {
    date,
    meal,
    foodId,
    amount: { mode: "grams", grams: value },
  });
  if (result !== "ok") throw new Error(`entry not added: ${result}`);
}

const names = (foods: { name: string }[]) => foods.map((food) => food.name);

describe("listRecentFoods", () => {
  it("lists this meal's foods first, newest first, then fills from other meals", async () => {
    const alice = await newUserId("alice@mail.com");
    const oatsId = await insertSharedFood(oats);
    const coffee = await insertSharedFood({ name: "Кофе" });
    const soup = await insertSharedFood({ name: "Суп" });
    await grams(alice, oatsId, "breakfast", 60);
    await grams(alice, soup, "lunch", 300);
    await grams(alice, coffee, "breakfast", 250);
    expect(names(await listRecentFoods(testDb, alice, "breakfast", 8, new Set()))).toEqual([
      "Кофе",
      "Овсянка",
      "Суп",
    ]);
  });

  it("orders this meal's foods by when they were last eaten at this meal", async () => {
    const alice = await newUserId("alice@mail.com");
    const oatsId = await insertSharedFood(oats);
    const coffee = await insertSharedFood({ name: "Кофе" });
    await grams(alice, coffee, "breakfast", 250, "2026-10-08");
    await grams(alice, oatsId, "breakfast", 60, "2026-10-13");
    await grams(alice, coffee, "lunch", 250, DAY);
    expect(names(await listRecentFoods(testDb, alice, "breakfast", 8, new Set()))).toEqual([
      "Овсянка",
      "Кофе",
    ]);
  });

  it("lists each food once and stops at the limit", async () => {
    const alice = await newUserId("alice@mail.com");
    const oatsId = await insertSharedFood(oats);
    const coffee = await insertSharedFood({ name: "Кофе" });
    await grams(alice, oatsId, "breakfast", 60);
    await grams(alice, oatsId, "breakfast", 70);
    await grams(alice, coffee, "breakfast", 250);
    expect(names(await listRecentFoods(testDb, alice, "breakfast", 1, new Set()))).toEqual([
      "Кофе",
    ]);
    expect(names(await listRecentFoods(testDb, alice, "breakfast", 8, new Set()))).toEqual([
      "Кофе",
      "Овсянка",
    ]);
  });

  it("repeats the food's last amount and prices it with the food's current numbers", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createOwnFood(alice, { ...oats, fiber100: null });
    await grams(alice, id, "breakfast", 60);
    await grams(alice, id, "breakfast", 80);
    await updateOwnFood(testDb, alice, id, { ...oats, kcal100: 400, fiber100: null });
    const [recent] = await listRecentFoods(testDb, alice, "breakfast", 8, new Set());
    expect(recent?.amount).toEqual({
      grams: 80,
      portionLabel: null,
      portionGrams: null,
      portionCount: null,
    });
    expect(recent?.kcal).toBe(320);
  });

  it("keeps a portion amount", async () => {
    const alice = await newUserId("alice@mail.com");
    const egg = await insertSharedFood({ name: "Яйцо", kcal100: 150 });
    const piece = await insertSharedPortion(egg, "1 шт", 60);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      foodId: egg,
      amount: { mode: "portion", portionId: piece, count: 2 },
    });
    const [recent] = await listRecentFoods(testDb, alice, "breakfast", 8, new Set());
    expect(recent?.amount).toEqual({
      grams: 120,
      portionLabel: "1 шт",
      portionGrams: 60,
      portionCount: 2,
    });
    expect(recent?.kcal).toBe(180);
  });

  it("skips just-kcal entries, deleted foods, other users and excluded foods", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id: gone } = await createOwnFood(alice, { ...oats, name: "Старое", fiber100: null });
    const kept = await insertSharedFood({ name: "Кофе" });
    const starred = await insertSharedFood({ name: "Мёд" });
    await grams(alice, gone, "breakfast", 60);
    await grams(alice, kept, "breakfast", 250);
    await grams(alice, starred, "breakfast", 10);
    await grams(bob, await insertSharedFood({ name: "Бобов" }), "breakfast", 100);
    await deleteOwnFood(testDb, alice, gone);
    await testDb.insert(diaryEntries).values({
      userId: alice,
      date: DAY,
      meal: "breakfast",
      foodId: null,
      foodName: "Быстрый ввод",
      kcal100: 450,
      protein100: 0,
      fat100: 0,
      carbs100: 0,
      grams: 100,
    });
    expect(names(await listRecentFoods(testDb, alice, "breakfast", 8, new Set([starred])))).toEqual(
      ["Кофе"],
    );
  });
});

describe("listFavoriteFoods", () => {
  it("lists the user's starred visible foods with their last amount, if any", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const coffee = await insertSharedFood({ name: "Кофе", kcal100: 2 });
    const honey = await insertSharedFood({ name: "Мёд" });
    const { id: gone } = await createOwnFood(alice, { ...oats, name: "Старое", fiber100: null });
    await grams(alice, coffee, "breakfast", 250);
    await testDb.insert(favorites).values([
      { userId: alice, foodId: coffee },
      { userId: alice, foodId: honey },
      { userId: alice, foodId: gone },
      { userId: bob, foodId: honey },
    ]);
    await deleteOwnFood(testDb, alice, gone);
    const found = await listFavoriteFoods(testDb, alice);
    expect(found.map((food) => [food.name, food.amount?.grams ?? null, food.kcal])).toEqual(
      expect.arrayContaining([
        ["Кофе", 250, 5],
        ["Мёд", null, null],
      ]),
    );
    expect(found).toHaveLength(2);
  });
});

describe("findRepeatSource", () => {
  it("finds the last earlier day with entries for this meal", async () => {
    const alice = await newUserId("alice@mail.com");
    const oatsId = await insertSharedFood(oats);
    const coffee = await insertSharedFood({ name: "Кофе" });
    await grams(alice, oatsId, "breakfast", 50, "2026-10-12");
    await grams(alice, oatsId, "breakfast", 60, DAY);
    await grams(alice, coffee, "breakfast", 250, DAY);
    await grams(alice, coffee, "lunch", 250, NEXT);
    const source = await findRepeatSource(testDb, alice, NEXT, "breakfast");
    expect(source?.date).toBe(DAY);
    expect(source?.entries.map((entry) => [entry.foodName, entry.grams])).toEqual([
      ["Овсянка", 60],
      ["Кофе", 250],
    ]);
  });

  it("includes just-kcal entries", async () => {
    const alice = await newUserId("alice@mail.com");
    await testDb.insert(diaryEntries).values({
      userId: alice,
      date: DAY,
      meal: "snack",
      foodId: null,
      foodName: "Быстрый ввод",
      kcal100: 450,
      protein100: 0,
      fat100: 0,
      carbs100: 0,
      grams: 100,
    });
    expect((await findRepeatSource(testDb, alice, NEXT, "snack"))?.entries).toHaveLength(1);
  });

  it("offers nothing when the meal is already filled or there is no earlier day", async () => {
    const alice = await newUserId("alice@mail.com");
    const oatsId = await insertSharedFood(oats);
    await grams(alice, oatsId, "breakfast", 60, DAY);
    expect(await findRepeatSource(testDb, alice, DAY, "breakfast")).toBeNull();
    await grams(alice, oatsId, "breakfast", 60, NEXT);
    expect(await findRepeatSource(testDb, alice, NEXT, "breakfast")).toBeNull();
    expect(await findRepeatSource(testDb, alice, NEXT, "dinner")).toBeNull();
  });

  it("never offers another user's meal", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    await grams(bob, await insertSharedFood(oats), "breakfast", 60, DAY);
    expect(await findRepeatSource(testDb, alice, NEXT, "breakfast")).toBeNull();
  });
});
