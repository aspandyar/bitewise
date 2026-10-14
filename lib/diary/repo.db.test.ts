import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { diaryEntries, users } from "@/db/schema";
import { DIARY_LIMITS } from "@/lib/config";
import {
  addPortion,
  deleteOwnPortion,
  listVisiblePortions,
  softDeleteOwnFood,
  updateOwnFood,
} from "@/lib/foods/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, insertSharedFood, insertSharedPortion, newUserId } from "@/tests/foods";
import {
  addEntry,
  countDayEntries,
  deleteEntry,
  getDayEntries,
  getEntry,
  updateEntry,
} from "./repo";

const DAY = "2026-10-11";
const buckwheat = { name: "Гречка", kcal100: 343, protein100: 13.3, fat100: 3.4, carbs100: 62.1 };
const ownSoup = { ...buckwheat, name: "Мой суп", fiber100: null };

beforeEach(resetDb);
afterAll(closeTestDb);

async function onlyEntry(userId: string, date = DAY) {
  const [entry, ...rest] = await getDayEntries(testDb, userId, date);
  expect(rest).toHaveLength(0);
  if (!entry) throw new Error("no entry");
  return entry;
}

async function ownPortionId(userId: string, foodId: string, label: string): Promise<string> {
  const portion = (await listVisiblePortions(testDb, userId, foodId)).find(
    (p) => p.label === label,
  );
  if (!portion) throw new Error(`portion ${label} not found`);
  return portion.id;
}

describe("grams computed from a portion", () => {
  it("refuses an entry heavier than a grams entry may be", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const portionId = await insertSharedPortion(foodId, "кастрюля", DIARY_LIMITS.grams.max);
    const result = await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "portion", portionId, count: 2 },
    });
    expect(result).toBe("grams_out_of_range");
    expect(await getDayEntries(testDb, alice, DAY)).toEqual([]);
  });

  it("refuses an edit that pushes the count past the grams range", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const portionId = await insertSharedPortion(foodId, "кастрюля", DIARY_LIMITS.grams.max);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "portion", portionId, count: 1 },
    });
    const entry = await onlyEntry(alice);
    expect(
      await updateEntry(testDb, alice, entry.id, {
        meal: "lunch",
        amount: { mode: "portion", count: 2 },
      }),
    ).toBe("grams_out_of_range");
    expect((await onlyEntry(alice)).grams).toBe(DIARY_LIMITS.grams.max);
  });
});

describe("addEntry", () => {
  it("adds an entry by grams with a snapshot of the food", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const result = await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 150 },
    });
    expect(result).toBe("ok");
    expect(await onlyEntry(alice)).toEqual({
      id: expect.any(String),
      date: DAY,
      meal: "lunch",
      foodId,
      foodName: "Гречка",
      kcal100: 343,
      protein100: 13.3,
      fat100: 3.4,
      carbs100: 62.1,
      grams: 150,
      portionLabel: null,
      portionGrams: null,
      portionCount: null,
    });
  });

  it("adds an entry by a shared portion", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood({ name: "Яйцо" });
    const portionId = await insertSharedPortion(foodId, "1 шт", 60);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      foodId,
      amount: { mode: "portion", portionId, count: 1.5 },
    });
    expect(await onlyEntry(alice)).toMatchObject({
      grams: 90,
      portionLabel: "1 шт",
      portionGrams: 60,
      portionCount: 1.5,
    });
  });

  it("accepts the user's own portion of a shared food", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await addPortion(testDb, alice, foodId, { label: "моя тарелка", grams: 250 });
    const portionId = await ownPortionId(alice, foodId, "моя тарелка");
    const result = await addEntry(testDb, alice, {
      date: DAY,
      meal: "dinner",
      foodId,
      amount: { mode: "portion", portionId, count: 1 },
    });
    expect(result).toBe("ok");
    expect((await onlyEntry(alice)).grams).toBe(250);
  });

  it("keeps the snapshot after the food is edited, renamed and deleted", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id: foodId } = await createOwnFood(alice, ownSoup);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 300 },
    });
    await updateOwnFood(testDb, alice, foodId, { ...ownSoup, name: "Суп 2", kcal100: 10 });
    await softDeleteOwnFood(testDb, alice, foodId);
    expect(await onlyEntry(alice)).toMatchObject({ foodName: "Мой суп", kcal100: 343, grams: 300 });
  });

  it("keeps the portion snapshot after the portion is deleted", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await addPortion(testDb, alice, foodId, { label: "моя тарелка", grams: 250 });
    const portionId = await ownPortionId(alice, foodId, "моя тарелка");
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "portion", portionId, count: 2 },
    });
    await deleteOwnPortion(testDb, alice, foodId, portionId);
    expect(await onlyEntry(alice)).toMatchObject({
      grams: 500,
      portionLabel: "моя тарелка",
      portionGrams: 250,
      portionCount: 2,
    });
  });

  it("refuses foods and portions the user cannot see", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const shared = await insertSharedFood(buckwheat);
    const other = await insertSharedFood({ name: "Рис" });
    const otherPortion = await insertSharedPortion(other, "1 стакан", 200);
    const { id: bobsFood } = await createOwnFood(bob, ownSoup);
    await addPortion(testDb, bob, shared, { label: "тарелка Боба", grams: 300 });
    const bobsPortion = await ownPortionId(bob, shared, "тарелка Боба");
    const { id: deleted } = await createOwnFood(alice, ownSoup);
    await softDeleteOwnFood(testDb, alice, deleted);

    const add = (foodId: string, amount: Parameters<typeof addEntry>[2]["amount"]) =>
      addEntry(testDb, alice, { date: DAY, meal: "lunch", foodId, amount });
    const grams = { mode: "grams", grams: 100 } as const;

    expect(await add(bobsFood, grams)).toBe("not_found");
    expect(await add(deleted, grams)).toBe("not_found");
    expect(await add(randomUUID(), grams)).toBe("not_found");
    expect(await add(shared, { mode: "portion", portionId: bobsPortion, count: 1 })).toBe(
      "not_found",
    );
    expect(await add(shared, { mode: "portion", portionId: otherPortion, count: 1 })).toBe(
      "not_found",
    );
    expect(await getDayEntries(testDb, alice, DAY)).toEqual([]);
  });

  it("stops at the daily entry limit but allows other days", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await testDb.insert(diaryEntries).values(
      Array.from({ length: DIARY_LIMITS.maxEntriesPerDay }, () => ({
        userId: alice,
        date: DAY,
        meal: "snack" as const,
        foodId,
        foodName: buckwheat.name,
        kcal100: buckwheat.kcal100,
        protein100: buckwheat.protein100,
        fat100: buckwheat.fat100,
        carbs100: buckwheat.carbs100,
        grams: 1,
      })),
    );
    const amount = { mode: "grams", grams: 10 } as const;
    expect(await addEntry(testDb, alice, { date: DAY, meal: "lunch", foodId, amount })).toBe(
      "limit",
    );
    expect(
      await addEntry(testDb, alice, { date: "2026-10-10", meal: "lunch", foodId, amount }),
    ).toBe("ok");
  });
});

describe("addEntry account cap", () => {
  it("stops at the per-account total even when every day has room", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const limits = { ...DIARY_LIMITS, maxEntriesTotal: 2 };
    const amount = { mode: "grams", grams: 10 } as const;
    const add = (date: string) =>
      addEntry(testDb, alice, { date, meal: "lunch", foodId, amount }, limits);
    expect(await add("2026-10-01")).toBe("ok");
    expect(await add("2026-10-02")).toBe("ok");
    expect(await add("2026-10-03")).toBe("total_limit");
    expect(await getDayEntries(testDb, alice, "2026-10-03")).toEqual([]);
  });
});

describe("getDayEntries and getEntry", () => {
  it("orders a day by meal, then by when entries were added", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    for (const [meal, grams] of [
      ["dinner", 1],
      ["breakfast", 2],
      ["dinner", 3],
    ] as const) {
      await addEntry(testDb, alice, { date: DAY, meal, foodId, amount: { mode: "grams", grams } });
    }
    const entries = await getDayEntries(testDb, alice, DAY);
    expect(entries.map((e) => [e.meal, e.grams])).toEqual([
      ["breakfast", 2],
      ["dinner", 1],
      ["dinner", 3],
    ]);
  });

  it("counts only the user's entries of that day", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const amount = { mode: "grams", grams: 10 } as const;
    await addEntry(testDb, alice, { date: DAY, meal: "lunch", foodId, amount });
    await addEntry(testDb, alice, { date: DAY, meal: "dinner", foodId, amount });
    await addEntry(testDb, alice, { date: "2026-10-10", meal: "lunch", foodId, amount });
    await addEntry(testDb, bob, { date: DAY, meal: "lunch", foodId, amount });
    expect(await countDayEntries(testDb, alice, DAY)).toBe(2);
    expect(await countDayEntries(testDb, alice, "2026-10-09")).toBe(0);
  });

  it("never shows another user's day or entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    const entry = await onlyEntry(alice);
    expect(await getDayEntries(testDb, bob, DAY)).toEqual([]);
    expect(await getEntry(testDb, bob, entry.id)).toBeNull();
    expect(await getEntry(testDb, alice, entry.id)).toEqual(entry);
    expect(await getEntry(testDb, alice, randomUUID())).toBeNull();
  });
});

describe("updateEntry", () => {
  async function portionEntry() {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood({ name: "Яйцо" });
    const portionId = await insertSharedPortion(foodId, "1 шт", 60);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "breakfast",
      foodId,
      amount: { mode: "portion", portionId, count: 1 },
    });
    return { alice, entry: await onlyEntry(alice) };
  }

  it("changes the portion count and meal, recomputing grams", async () => {
    const { alice, entry } = await portionEntry();
    const result = await updateEntry(testDb, alice, entry.id, {
      meal: "snack",
      amount: { mode: "portion", count: 2 },
    });
    expect(result).toEqual({ date: DAY });
    expect(await onlyEntry(alice)).toMatchObject({
      meal: "snack",
      grams: 120,
      portionLabel: "1 шт",
      portionGrams: 60,
      portionCount: 2,
    });
  });

  it("switches a portion entry to grams and drops the portion", async () => {
    const { alice, entry } = await portionEntry();
    await updateEntry(testDb, alice, entry.id, {
      meal: "breakfast",
      amount: { mode: "grams", grams: 75 },
    });
    expect(await onlyEntry(alice)).toMatchObject({
      grams: 75,
      portionLabel: null,
      portionGrams: null,
      portionCount: null,
      kcal100: entry.kcal100,
    });
  });

  it("refuses a portion count on a grams entry", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    const entry = await onlyEntry(alice);
    expect(
      await updateEntry(testDb, alice, entry.id, {
        meal: "lunch",
        amount: { mode: "portion", count: 2 },
      }),
    ).toBeNull();
    expect(await onlyEntry(alice)).toEqual(entry);
  });

  it("switches a grams entry to a portion of its food", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const portionId = await insertSharedPortion(foodId, "тарелка", 250);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    const entry = await onlyEntry(alice);
    expect(
      await updateEntry(testDb, alice, entry.id, {
        meal: "lunch",
        amount: { mode: "portion", portionId, count: 2 },
      }),
    ).toEqual({ date: DAY });
    expect(await onlyEntry(alice)).toMatchObject({
      grams: 500,
      portionLabel: "тарелка",
      portionGrams: 250,
      portionCount: 2,
    });
  });

  it("refuses a portion of another food when switching from grams", async () => {
    const alice = await newUserId("alice@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    const milk = await insertSharedFood({ name: "Молоко" });
    const glass = await insertSharedPortion(milk, "стакан", 200);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    const entry = await onlyEntry(alice);
    expect(
      await updateEntry(testDb, alice, entry.id, {
        meal: "lunch",
        amount: { mode: "portion", portionId: glass, count: 1 },
      }),
    ).toBeNull();
    expect(await onlyEntry(alice)).toEqual(entry);
  });

  it("does not touch another user's entry", async () => {
    const { alice, entry } = await portionEntry();
    const bob = await newUserId("bob@mail.com");
    expect(
      await updateEntry(testDb, bob, entry.id, {
        meal: "snack",
        amount: { mode: "grams", grams: 1 },
      }),
    ).toBeNull();
    expect(await onlyEntry(alice)).toEqual(entry);
  });
});

describe("deleteEntry", () => {
  it("deletes only the owner's entry and returns its date", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const foodId = await insertSharedFood(buckwheat);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    const entry = await onlyEntry(alice);
    expect(await deleteEntry(testDb, bob, entry.id)).toBeNull();
    expect(await deleteEntry(testDb, alice, entry.id)).toEqual({ date: DAY });
    expect(await getDayEntries(testDb, alice, DAY)).toEqual([]);
  });
});

describe("deleting a user", () => {
  it("removes their diary even when it references their own foods", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id: foodId } = await createOwnFood(alice, ownSoup);
    await addEntry(testDb, alice, {
      date: DAY,
      meal: "lunch",
      foodId,
      amount: { mode: "grams", grams: 100 },
    });
    await testDb.delete(users).where(eq(users.id, alice));
    expect(await testDb.select().from(diaryEntries)).toEqual([]);
  });
});
