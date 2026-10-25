import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addEntry } from "@/lib/diary/repo";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { insertSharedFood, newUserId } from "@/tests/foods";
import { getPeriodEntries } from "./repo";

beforeEach(resetDb);
afterAll(closeTestDb);

async function log(userId: string, foodId: string, date: string, grams: number) {
  const result = await addEntry(testDb, userId, {
    date,
    meal: "lunch",
    foodId,
    amount: { mode: "grams", grams },
  });
  if (result !== "ok") throw new Error(`entry not added: ${result}`);
}

describe("getPeriodEntries", () => {
  it("returns the user's entries from the first to the last day, both included", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const rice = await insertSharedFood({
      name: "Рис",
      kcal100: 130,
      protein100: 2.7,
      fat100: 0.3,
      carbs100: 28,
    });
    await log(alice, rice, "2026-10-18", 100);
    await log(alice, rice, "2026-10-19", 150);
    await log(alice, rice, "2026-10-25", 200);
    await log(alice, rice, "2026-10-26", 50);
    await log(bob, rice, "2026-10-20", 300);

    const entries = await getPeriodEntries(testDb, alice, "2026-10-19", "2026-10-25");
    expect(entries.map((entry) => [entry.date, entry.grams]).sort()).toEqual([
      ["2026-10-19", 150],
      ["2026-10-25", 200],
    ]);
    expect(entries[0]).toMatchObject({ kcal100: 130, protein100: 2.7, fat100: 0.3, carbs100: 28 });
  });
});
