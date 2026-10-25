import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { newUserId } from "@/tests/foods";
import { addWater, getDayWater, removeWater } from "./repo";

const DAY = "2026-10-24";
const NEXT = "2026-10-25";
const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";

beforeEach(resetDb);
afterAll(closeTestDb);

describe("water", () => {
  it("adds up a day's water and keeps other days apart", async () => {
    const alice = await newUserId("alice@mail.com");
    expect(await getDayWater(testDb, alice, DAY)).toEqual({ totalMl: 0, lastId: null });
    await addWater(testDb, alice, { date: DAY, ml: 250 });
    await addWater(testDb, alice, { date: DAY, ml: 500 });
    await addWater(testDb, alice, { date: NEXT, ml: 250 });
    expect((await getDayWater(testDb, alice, DAY)).totalMl).toBe(750);
    expect((await getDayWater(testDb, alice, NEXT)).totalMl).toBe(250);
  });

  it("does not add a second glass for a replayed request", async () => {
    const alice = await newUserId("alice@mail.com");
    expect(await addWater(testDb, alice, { date: DAY, ml: 250, requestId: KEY_A })).toBe("ok");
    expect(await addWater(testDb, alice, { date: DAY, ml: 250, requestId: KEY_A })).toBe("ok");
    expect((await getDayWater(testDb, alice, DAY)).totalMl).toBe(250);
  });

  it("refuses a request key reused for another amount or day", async () => {
    const alice = await newUserId("alice@mail.com");
    await addWater(testDb, alice, { date: DAY, ml: 250, requestId: KEY_A });
    expect(await addWater(testDb, alice, { date: DAY, ml: 500, requestId: KEY_A })).toBe(
      "conflict",
    );
    expect(await addWater(testDb, alice, { date: NEXT, ml: 250, requestId: KEY_A })).toBe(
      "conflict",
    );
    expect((await getDayWater(testDb, alice, DAY)).totalMl).toBe(250);
    expect((await getDayWater(testDb, alice, NEXT)).totalMl).toBe(0);
  });

  it("stops at the daily cap", async () => {
    const alice = await newUserId("alice@mail.com");
    const caps = { maxEntriesPerDay: 2, maxEntriesTotal: 10 };
    expect(await addWater(testDb, alice, { date: DAY, ml: 250 }, caps)).toBe("ok");
    expect(await addWater(testDb, alice, { date: DAY, ml: 250 }, caps)).toBe("ok");
    expect(await addWater(testDb, alice, { date: DAY, ml: 250 }, caps)).toBe("limit");
    expect(await addWater(testDb, alice, { date: NEXT, ml: 250 }, caps)).toBe("ok");
  });

  it("stops at the total cap across days", async () => {
    const alice = await newUserId("alice@mail.com");
    const caps = { maxEntriesPerDay: 5, maxEntriesTotal: 2 };
    expect(await addWater(testDb, alice, { date: DAY, ml: 250 }, caps)).toBe("ok");
    expect(await addWater(testDb, alice, { date: NEXT, ml: 250 }, caps)).toBe("ok");
    expect(await addWater(testDb, alice, { date: "2026-10-01", ml: 250 }, caps)).toBe(
      "total_limit",
    );
  });

  it("removes the latest glass by its id, and a replayed removal removes nothing more", async () => {
    const alice = await newUserId("alice@mail.com");
    await addWater(testDb, alice, { date: DAY, ml: 250, requestId: KEY_A });
    await addWater(testDb, alice, { date: DAY, ml: 500, requestId: KEY_B });
    const { lastId } = await getDayWater(testDb, alice, DAY);
    expect(lastId).not.toBeNull();
    expect(await removeWater(testDb, alice, lastId!)).toEqual({ date: DAY });
    expect(await removeWater(testDb, alice, lastId!)).toBeNull();
    expect((await getDayWater(testDb, alice, DAY)).totalMl).toBe(250);
  });

  it("never shows or removes another user's water", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    await addWater(testDb, alice, { date: DAY, ml: 500 });
    const { lastId } = await getDayWater(testDb, alice, DAY);
    expect((await getDayWater(testDb, bob, DAY)).totalMl).toBe(0);
    expect(await removeWater(testDb, bob, lastId!)).toBeNull();
    expect((await getDayWater(testDb, alice, DAY)).totalMl).toBe(500);
  });
});
