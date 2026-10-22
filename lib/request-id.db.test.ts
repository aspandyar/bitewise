import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { diaryEntries, foodPortions, foods, recipeItems, recipes } from "@/db/schema";
import { addEntry, addQuickEntry, getDayEntries } from "@/lib/diary/repo";
import { isFavorite, quickAddEntry, repeatMeal, setFavorite } from "@/lib/diary/quick-repo";
import { addPortion, copyFood, createFood } from "@/lib/foods/repo";
import { addItem, createRecipe } from "@/lib/recipes/repo";
import { createUser } from "@/lib/users/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { insertSharedFood, insertSharedPortion, newUserId } from "@/tests/foods";

// A replayed request (the response was lost and Next sent it again) carries the same key and
// must find the row the first one made (#95).

const DAY = "2026-10-21";
const coffee = { name: "Кофе", kcal: 40, proteinG: 0, fatG: 0, carbsG: 0 };
const ownFood = {
  name: "Сырники",
  kcal100: 220,
  protein100: 15,
  fat100: 9,
  carbs100: 20,
  fiber100: null,
};

beforeEach(resetDb);
afterAll(closeTestDb);

async function entryCount(userId: string) {
  return (await getDayEntries(testDb, userId, DAY)).length;
}

async function rows(
  table: typeof foods | typeof foodPortions | typeof recipes | typeof recipeItems,
) {
  const [row] = await testDb.select({ total: count() }).from(table);
  return row?.total ?? 0;
}

describe("diary entries", () => {
  it("addEntry with the same key adds one entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    const input = {
      date: DAY,
      meal: "breakfast" as const,
      foodId: food,
      amount: { mode: "grams" as const, grams: 60 },
      requestId: randomUUID(),
    };
    expect(await addEntry(testDb, alice, input)).toBe("ok");
    expect(await addEntry(testDb, alice, input)).toBe("ok");
    expect(await entryCount(alice)).toBe(1);
  });

  it("a replay of the last allowed entry is not refused by the day limit", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    const input = {
      date: DAY,
      meal: "breakfast" as const,
      foodId: food,
      amount: { mode: "grams" as const, grams: 60 },
      requestId: randomUUID(),
    };
    const limits = { maxEntriesPerDay: 1, maxEntriesTotal: 10 };
    expect(await addEntry(testDb, alice, input, limits)).toBe("ok");
    expect(await addEntry(testDb, alice, input, limits)).toBe("ok");
    expect(await entryCount(alice)).toBe(1);
  });

  it("addQuickEntry with the same key returns the first entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const input = { date: DAY, meal: "snack" as const, values: coffee, requestId: randomUUID() };
    const first = await addQuickEntry(testDb, alice, input);
    expect(await addQuickEntry(testDb, alice, input)).toEqual(first);
    expect(await entryCount(alice)).toBe(1);
  });

  it("quickAddEntry with the same key returns the first entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    await addEntry(testDb, alice, {
      date: "2026-10-20",
      meal: "breakfast",
      foodId: food,
      amount: { mode: "grams", grams: 60 },
    });
    const input = { date: DAY, meal: "breakfast" as const, foodId: food, requestId: randomUUID() };
    const first = await quickAddEntry(testDb, alice, input);
    expect(await quickAddEntry(testDb, alice, input)).toEqual(first);
    expect(await entryCount(alice)).toBe(1);
  });

  it("a replayed quick add at the day limit returns the first entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    await addEntry(testDb, alice, {
      date: "2026-10-20",
      meal: "breakfast",
      foodId: food,
      amount: { mode: "grams", grams: 60 },
    });
    const input = { date: DAY, meal: "breakfast" as const, foodId: food, requestId: randomUUID() };
    const limits = { maxEntriesPerDay: 1, maxEntriesTotal: 10 };
    const first = await quickAddEntry(testDb, alice, input, limits);
    expect(await quickAddEntry(testDb, alice, input, limits)).toEqual(first);
  });

  it("concurrent requests with one key add one entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const input = { date: DAY, meal: "snack" as const, values: coffee, requestId: randomUUID() };
    const [a, b] = await Promise.all([
      addQuickEntry(testDb, alice, input),
      addQuickEntry(testDb, alice, input),
    ]);
    expect(a).toEqual(b);
    expect(await entryCount(alice)).toBe(1);
  });

  it("keys are per user, and entries without a key are never merged", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const requestId = randomUUID();
    await addQuickEntry(testDb, alice, { date: DAY, meal: "snack", values: coffee, requestId });
    await addQuickEntry(testDb, bob, { date: DAY, meal: "snack", values: coffee, requestId });
    await addQuickEntry(testDb, alice, { date: DAY, meal: "snack", values: coffee });
    await addQuickEntry(testDb, alice, { date: DAY, meal: "snack", values: coffee });
    expect(await entryCount(alice)).toBe(3);
    expect(await entryCount(bob)).toBe(1);
    const [stored] = await testDb
      .select({ total: count() })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, alice), eq(diaryEntries.clientRequestId, requestId)));
    expect(stored?.total).toBe(1);
  });
});

describe("a key reused for something else", () => {
  it("is refused instead of answering with the other row", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    const requestId = randomUUID();
    const grams = { mode: "grams" as const, grams: 60 };
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      foodId: food,
      amount: grams,
      requestId,
    });
    expect(
      await addEntry(testDb, alice, {
        date: "2026-10-20",
        meal: "breakfast",
        foodId: food,
        amount: grams,
        requestId,
      }),
    ).toBe("not_found");
    expect(
      await quickAddEntry(testDb, alice, { date: DAY, meal: "lunch", foodId: food, requestId }),
    ).toBe("not_found");
    expect(
      await addQuickEntry(testDb, alice, { date: DAY, meal: "snack", values: coffee, requestId }),
    ).toBe("not_found");
    expect(await entryCount(alice)).toBe(1);
  });

  it("refuses a portion or an ingredient for another food or dish", async () => {
    const alice = await newUserId("alice@mail.com");
    const bread = await insertSharedFood({ name: "Хлеб" });
    const cheese = await insertSharedFood({ name: "Сыр" });
    const requestId = randomUUID();
    const portion = { label: "ломтик", grams: 30 };
    expect(await addPortion(testDb, alice, bread, portion, requestId)).toBe("ok");
    expect(await addPortion(testDb, alice, cheese, portion, requestId)).toBe("not_found");
    const [a, b] = [
      await createRecipe(testDb, alice, { name: "А", cookedWeightG: null, servings: null }),
      await createRecipe(testDb, alice, { name: "Б", cookedWeightG: null, servings: null }),
    ];
    if (a === "limit" || b === "limit") throw new Error("recipe cap reached in a test");
    const input = { foodId: bread, amount: { mode: "grams" as const, grams: 50 }, requestId };
    expect(await addItem(testDb, alice, a.id, input)).toBe("ok");
    expect(await addItem(testDb, alice, b.id, input)).toBe("not_found");
    expect(await rows(recipeItems)).toBe(1);
  });
});

describe("foods and portions", () => {
  it("createFood with the same key creates one food and says the second was a replay", async () => {
    const alice = await newUserId("alice@mail.com");
    const requestId = randomUUID();
    const first = await createFood(testDb, alice, ownFood, { requestId });
    const second = await createFood(testDb, alice, ownFood, { requestId });
    expect(first).toEqual({ id: expect.any(String), replayed: false });
    expect(second).toEqual({ id: typeof first !== "string" ? first.id : "", replayed: true });
    expect(await rows(foods)).toBe(1);
  });

  it("keys are per owner", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const requestId = randomUUID();
    await createFood(testDb, alice, ownFood, { requestId });
    expect(await createFood(testDb, bob, ownFood, { requestId })).toMatchObject({
      replayed: false,
    });
    expect(await rows(foods)).toBe(2);
  });

  it("copyFood with the same key makes one copy with its portions copied once", async () => {
    const alice = await newUserId("alice@mail.com");
    const shared = await insertSharedFood({ name: "Яйцо" });
    await insertSharedPortion(shared, "1 шт", 55);
    const requestId = randomUUID();
    const first = await copyFood(testDb, alice, shared, requestId);
    expect(await copyFood(testDb, alice, shared, requestId)).toEqual(first);
    expect(await rows(foods)).toBe(2);
    expect(await rows(foodPortions)).toBe(2);
  });

  it("addPortion with the same key adds one portion", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Хлеб" });
    const requestId = randomUUID();
    const portion = { label: "ломтик", grams: 30 };
    expect(await addPortion(testDb, alice, food, portion, requestId)).toBe("ok");
    expect(await addPortion(testDb, alice, food, portion, requestId)).toBe("ok");
    expect(await rows(foodPortions)).toBe(1);
  });
});

describe("recipes", () => {
  const porridge = { name: "Каша", cookedWeightG: 500, servings: 4 };

  it("createRecipe with the same key creates one dish", async () => {
    const alice = await newUserId("alice@mail.com");
    const requestId = randomUUID();
    const first = await createRecipe(testDb, alice, porridge, requestId);
    expect(await createRecipe(testDb, alice, porridge, requestId)).toEqual(first);
    expect(await rows(recipes)).toBe(1);
    expect(await rows(foods)).toBe(1);
  });

  it("concurrent creates with one key make one dish", async () => {
    const alice = await newUserId("alice@mail.com");
    const requestId = randomUUID();
    const [a, b] = await Promise.all([
      createRecipe(testDb, alice, porridge, requestId),
      createRecipe(testDb, alice, porridge, requestId),
    ]);
    expect(a).toEqual(b);
    expect(await rows(recipes)).toBe(1);
  });

  it("concurrent ingredient adds with one key, even into two dishes, add one row", async () => {
    const alice = await newUserId("alice@mail.com");
    const [a, b] = [
      await createRecipe(testDb, alice, porridge),
      await createRecipe(testDb, alice, { ...porridge, name: "Суп" }),
    ];
    if (a === "limit" || b === "limit") throw new Error("recipe cap reached in a test");
    const oats = await insertSharedFood({ name: "Овсянка" });
    const input = {
      foodId: oats,
      amount: { mode: "grams" as const, grams: 80 },
      requestId: randomUUID(),
    };
    const results = await Promise.all([
      addItem(testDb, alice, a.id, input),
      addItem(testDb, alice, a.id, input),
      addItem(testDb, alice, b.id, input),
    ]);
    expect(results.filter((result) => result === "ok").length).toBeGreaterThanOrEqual(2);
    expect(await rows(recipeItems)).toBe(1);
  });

  it("a replay of the last allowed ingredient is not refused by the cap", async () => {
    const alice = await newUserId("alice@mail.com");
    const recipe = await createRecipe(testDb, alice, porridge);
    if (recipe === "limit") throw new Error("recipe cap reached in a test");
    const oats = await insertSharedFood({ name: "Овсянка" });
    const input = {
      foodId: oats,
      amount: { mode: "grams" as const, grams: 80 },
      requestId: randomUUID(),
    };
    expect(await addItem(testDb, alice, recipe.id, input, { maxItems: 1 })).toBe("ok");
    expect(await addItem(testDb, alice, recipe.id, input, { maxItems: 1 })).toBe("ok");
  });

  it("addItem with the same key adds one ingredient", async () => {
    const alice = await newUserId("alice@mail.com");
    const recipe = await createRecipe(testDb, alice, porridge);
    if (recipe === "limit") throw new Error("recipe cap reached in a test");
    const oats = await insertSharedFood({ name: "Овсянка" });
    const input = {
      foodId: oats,
      amount: { mode: "grams" as const, grams: 80 },
      requestId: randomUUID(),
    };
    expect(await addItem(testDb, alice, recipe.id, input)).toBe("ok");
    expect(await addItem(testDb, alice, recipe.id, input)).toBe("ok");
    expect(await rows(recipeItems)).toBe(1);
  });
});

describe("setFavorite", () => {
  it("sets the requested state, so a replay never flips it back", async () => {
    const alice = await newUserId("alice@mail.com");
    const food = await insertSharedFood({ name: "Овсянка" });
    expect(await setFavorite(testDb, alice, food, true)).toBe("on");
    expect(await setFavorite(testDb, alice, food, true)).toBe("on");
    expect(await isFavorite(testDb, alice, food)).toBe(true);
    expect(await setFavorite(testDb, alice, food, false)).toBe("off");
    expect(await setFavorite(testDb, alice, food, false)).toBe("off");
    expect(await isFavorite(testDb, alice, food)).toBe(false);
  });
});

describe("repeatMeal", () => {
  const NEXT = "2026-10-22";

  async function yesterdayBreakfast(userId: string) {
    const food = await insertSharedFood({ name: "Овсянка" });
    for (const grams of [60, 80]) {
      await addEntry(testDb, userId, {
        date: DAY,
        meal: "breakfast",
        foodId: food,
        amount: { mode: "grams", grams },
      });
    }
  }

  it("a replay answers with the ids the first repeat added, not 'already filled'", async () => {
    const alice = await newUserId("alice@mail.com");
    await yesterdayBreakfast(alice);
    const input = { date: NEXT, meal: "breakfast" as const, requestId: randomUUID() };
    const first = await repeatMeal(testDb, alice, input);
    const replay = await repeatMeal(testDb, alice, input);
    if (typeof first === "string") throw new Error(first);
    expect(first.ids).toHaveLength(2);
    expect(replay).toEqual(first);
    expect(await getDayEntries(testDb, alice, NEXT)).toHaveLength(2);
  });

  it("a replay still finds the batch after one of its entries was undone", async () => {
    const alice = await newUserId("alice@mail.com");
    await yesterdayBreakfast(alice);
    const input = { date: NEXT, meal: "breakfast" as const, requestId: randomUUID() };
    const first = await repeatMeal(testDb, alice, input);
    if (typeof first === "string") throw new Error(first);
    await testDb.delete(diaryEntries).where(eq(diaryEntries.id, first.ids[0]!));
    expect(await repeatMeal(testDb, alice, input)).toEqual({ ids: [first.ids[1]] });
  });

  it("refuses a key the user already spent on another meal", async () => {
    const alice = await newUserId("alice@mail.com");
    await yesterdayBreakfast(alice);
    const requestId = randomUUID();
    await repeatMeal(testDb, alice, { date: NEXT, meal: "breakfast", requestId });
    expect(await repeatMeal(testDb, alice, { date: NEXT, meal: "lunch", requestId })).toBe(
      "not_found",
    );
  });
});

describe("createUser", () => {
  const hash = "scrypt$test";

  it("a replayed sign-up finds the account it made instead of 'email taken'", async () => {
    const requestId = randomUUID();
    const first = await createUser(testDb, { email: "new@mail.com", passwordHash: hash, requestId });
    const replay = await createUser(testDb, { email: "new@mail.com", passwordHash: hash, requestId });
    expect(first).not.toBeNull();
    expect(replay).toEqual(first);
  });

  it("a taken email with another key or no key is still refused", async () => {
    await createUser(testDb, { email: "new@mail.com", passwordHash: hash, requestId: randomUUID() });
    expect(
      await createUser(testDb, { email: "new@mail.com", passwordHash: hash, requestId: randomUUID() }),
    ).toBeNull();
    expect(await createUser(testDb, { email: "new@mail.com", passwordHash: hash })).toBeNull();
  });

  it("a key already used by another account gives nothing, not an error", async () => {
    const requestId = randomUUID();
    await createUser(testDb, { email: "first@mail.com", passwordHash: hash, requestId });
    expect(
      await createUser(testDb, { email: "second@mail.com", passwordHash: hash, requestId }),
    ).toBeNull();
  });
});
