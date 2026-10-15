import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addPortion,
  deleteOwnPortion,
  listVisiblePortions,
  softDeleteOwnFood,
} from "@/lib/foods/repo";
import { calcEntryNutrients } from "@/lib/nutrition";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, insertSharedFood, newUserId } from "@/tests/foods";
import { isFavorite, quickAddEntry, repeatMeal, toggleFavorite } from "./quick-repo";
import { addEntry, addQuickEntry, deleteOwnEntries, getDayEntries, updateQuickEntry } from "./repo";

const DAY = "2026-10-14";
const NEXT = "2026-10-15";
const oats = { name: "Овсянка", kcal100: 350, protein100: 12, fat100: 6, carbs100: 60 };
const limits = (maxEntriesPerDay: number) => ({ maxEntriesPerDay, maxEntriesTotal: 100 });

beforeEach(resetDb);
afterAll(closeTestDb);

async function grams(
  userId: string,
  foodId: string,
  value: number,
  date = DAY,
  meal: "breakfast" | "lunch" = "breakfast",
) {
  const result = await addEntry(testDb, userId, {
    date,
    meal,
    foodId,
    amount: { mode: "grams", grams: value },
  });
  if (result !== "ok") throw new Error(`entry not added: ${result}`);
}

describe("quickAddEntry", () => {
  it("adds the food again with its last amount", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60);
    const added = await quickAddEntry(testDb, alice, {
      date: NEXT,
      meal: "breakfast",
      foodId: food,
    });
    if (typeof added === "string") throw new Error(added);
    const [entry] = await getDayEntries(testDb, alice, NEXT);
    expect(entry).toMatchObject({
      id: added.id,
      foodId: food,
      grams: 60,
      portionLabel: null,
      meal: "breakfast",
    });
  });

  it("repeats a portion by its snapshot even after the portion is deleted", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Яйцо" });
    await addPortion(testDb, alice, food, { label: "моё яйцо", grams: 60 });
    const [portion] = await listVisiblePortions(testDb, alice, food);
    if (!portion) throw new Error("no portion");
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      foodId: food,
      amount: { mode: "portion", portionId: portion.id, count: 2 },
    });
    await deleteOwnPortion(testDb, alice, food, portion.id);
    await quickAddEntry(testDb, alice, { date: NEXT, meal: "breakfast", foodId: food });
    expect((await getDayEntries(testDb, alice, NEXT))[0]).toMatchObject({
      grams: 120,
      portionLabel: "моё яйцо",
      portionGrams: 60,
      portionCount: 2,
    });
  });

  it("refuses a deleted, foreign or never logged food", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id: own } = await createOwnFood(alice, { ...oats, fiber100: null });
    await grams(alice, own, 60);
    await softDeleteOwnFood(testDb, alice, own);
    const fresh = await insertSharedFood({ name: "Кефир" });
    const input = { date: NEXT, meal: "breakfast" as const };
    expect(await quickAddEntry(testDb, alice, { ...input, foodId: own })).toBe("not_found");
    expect(await quickAddEntry(testDb, bob, { ...input, foodId: own })).toBe("not_found");
    expect(await quickAddEntry(testDb, alice, { ...input, foodId: fresh })).toBe("no_amount");
  });

  it("keeps the daily cap", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60, NEXT);
    expect(
      await quickAddEntry(
        testDb,
        alice,
        { date: NEXT, meal: "breakfast", foodId: food },
        limits(1),
      ),
    ).toBe("limit");
  });
});

describe("repeatMeal", () => {
  it("copies the last filled day of the meal with its snapshots and just-kcal entries", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60);
    await addQuickEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      values: { name: "Кофе", kcal: 40, proteinG: 0, fatG: 0, carbsG: 0 },
    });
    const repeated = await repeatMeal(testDb, alice, { date: NEXT, meal: "breakfast" });
    if (typeof repeated === "string") throw new Error(repeated);
    expect(repeated.ids).toHaveLength(2);
    expect(
      (await getDayEntries(testDb, alice, NEXT)).map((entry) => [
        entry.foodName,
        entry.grams,
        entry.foodId,
      ]),
    ).toEqual([
      ["Овсянка", 60, food],
      ["Кофе", 100, null],
    ]);
  });

  it("refuses a filled meal and an empty history", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    expect(await repeatMeal(testDb, alice, { date: NEXT, meal: "breakfast" })).toBe("nothing");
    await grams(alice, food, 60);
    await grams(alice, food, 70, NEXT);
    expect(await repeatMeal(testDb, alice, { date: NEXT, meal: "breakfast" })).toBe("not_empty");
  });

  it("adds nothing when the whole meal does not fit the daily cap", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60);
    await grams(alice, food, 70);
    await grams(alice, food, 80, NEXT, "lunch");
    expect(await repeatMeal(testDb, alice, { date: NEXT, meal: "breakfast" }, limits(2))).toBe(
      "limit",
    );
    expect(await getDayEntries(testDb, alice, NEXT)).toHaveLength(1);
  });
});

describe("deleteOwnEntries", () => {
  it("deletes only the user's entries from the list", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60);
    await grams(bob, food, 60);
    const [mine] = await getDayEntries(testDb, alice, DAY);
    const [theirs] = await getDayEntries(testDb, bob, DAY);
    if (!mine || !theirs) throw new Error("no entries");
    expect(await deleteOwnEntries(testDb, alice, [mine.id, theirs.id, randomUUID()])).toBe(1);
    expect(await getDayEntries(testDb, alice, DAY)).toEqual([]);
    expect(await getDayEntries(testDb, bob, DAY)).toHaveLength(1);
  });
});

describe("just-kcal entries", () => {
  it("counts exactly the typed kcal and macros", async () => {
    const alice = await newUserId("alice@mail.com");
    await addQuickEntry(testDb, alice, {
      date: DAY,
      meal: "snack",
      values: { name: "Пирожок", kcal: 312.5, proteinG: 8, fatG: 12.5, carbsG: 40 },
    });
    const [entry] = await getDayEntries(testDb, alice, DAY);
    if (!entry) throw new Error("no entry");
    expect(entry).toMatchObject({ foodId: null, foodName: "Пирожок", grams: 100 });
    expect(calcEntryNutrients(entry, entry.grams)).toEqual({
      kcal: 312.5,
      proteinG: 8,
      fatG: 12.5,
      carbsG: 40,
    });
  });

  it("edits its values and meal, and only for a just-kcal entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    await grams(alice, food, 60);
    await addQuickEntry(testDb, alice, {
      date: DAY,
      meal: "snack",
      values: { name: "Пирожок", kcal: 300, proteinG: 0, fatG: 0, carbsG: 0 },
    });
    const [regular, quick] = await getDayEntries(testDb, alice, DAY);
    if (!regular || !quick) throw new Error("no entries");
    const values = { name: "Булка", kcal: 250, proteinG: 5, fatG: 3, carbsG: 45 };
    expect(await updateQuickEntry(testDb, alice, quick.id, { meal: "lunch", values })).toEqual({
      date: DAY,
    });
    expect(await updateQuickEntry(testDb, alice, regular.id, { meal: "lunch", values })).toBeNull();
    expect((await getDayEntries(testDb, alice, DAY)).find((e) => e.id === quick.id)).toMatchObject({
      foodName: "Булка",
      meal: "lunch",
      kcal100: 250,
      protein100: 5,
      fat100: 3,
      carbs100: 45,
    });
  });
});

describe("toggleFavorite", () => {
  it("stars and unstars a visible food", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood(oats);
    expect(await toggleFavorite(testDb, alice, food)).toBe("added");
    expect(await isFavorite(testDb, alice, food)).toBe(true);
    expect(await toggleFavorite(testDb, alice, food)).toBe("removed");
    expect(await isFavorite(testDb, alice, food)).toBe(false);
  });

  it("refuses another user's food and keeps the cap", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id: own } = await createOwnFood(alice, { ...oats, fiber100: null });
    expect(await toggleFavorite(testDb, bob, own)).toBe("not_found");
    const foods = await Promise.all(
      Array.from({ length: 2 }, (_, i) => insertSharedFood({ name: `Продукт ${i}` })),
    );
    expect(await toggleFavorite(testDb, alice, foods[0] ?? "", 1)).toBe("added");
    expect(await toggleFavorite(testDb, alice, foods[1] ?? "", 1)).toBe("limit");
  });
});
