import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PORTION_LIMITS } from "@/lib/config";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { insertSharedFood, insertSharedPortion, newUserId } from "@/tests/foods";
import type { FoodValues } from "./types";
import {
  addPortion,
  copyFood,
  createFood,
  deleteOwnPortion,
  getVisibleFood,
  listOwnFoods,
  listVisiblePortions,
  softDeleteOwnFood,
  updateOwnFood,
} from "./repo";

const oats: FoodValues = {
  name: "Овсянка моя",
  kcal100: 350.5,
  protein100: 12,
  fat100: 6.2,
  carbs100: 60,
  fiber100: null,
};

beforeEach(resetDb);
afterAll(closeTestDb);

describe("food visibility", () => {
  it("shows a user their own and shared foods but not someone else's", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const shared = await insertSharedFood({ name: "Гречка" });
    const { id: own } = await createFood(testDb, alice, oats);

    expect((await getVisibleFood(testDb, alice, own))?.isOwn).toBe(true);
    expect((await getVisibleFood(testDb, alice, shared))?.isOwn).toBe(false);
    expect(await getVisibleFood(testDb, bob, own)).toBeNull();
  });

  it("returns stored values with full precision and no owner id", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createFood(testDb, alice, oats);
    const food = await getVisibleFood(testDb, alice, id);
    expect(food).toEqual({ id, ...oats, source: "user", sourceUrl: null, isOwn: true });
    expect(food).not.toHaveProperty("ownerId");
  });

  it("returns null for an unknown id", async () => {
    const alice = await newUserId("alice@mail.com");
    expect(await getVisibleFood(testDb, alice, randomUUID())).toBeNull();
  });
});

describe("own foods", () => {
  it("updates only the owner's food", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id } = await createFood(testDb, alice, oats);

    expect(await updateOwnFood(testDb, bob, id, { ...oats, name: "Взлом" })).toBe(false);
    expect(await updateOwnFood(testDb, alice, id, { ...oats, kcal100: 360 })).toBe(true);
    expect((await getVisibleFood(testDb, alice, id))?.kcal100).toBe(360);
  });

  it("never updates or deletes a shared food", async () => {
    const alice = await newUserId("alice@mail.com");
    const shared = await insertSharedFood({ name: "Гречка" });
    expect(await updateOwnFood(testDb, alice, shared, oats)).toBe(false);
    expect(await softDeleteOwnFood(testDb, alice, shared)).toBe(false);
    expect((await getVisibleFood(testDb, alice, shared))?.name).toBe("Гречка");
  });

  it("hides a soft-deleted food everywhere and refuses to touch it again", async () => {
    const alice = await newUserId("alice@mail.com");
    const { id } = await createFood(testDb, alice, oats);

    expect(await softDeleteOwnFood(testDb, alice, id)).toBe(true);
    expect(await getVisibleFood(testDb, alice, id)).toBeNull();
    expect(await listOwnFoods(testDb, alice, 20)).toEqual([]);
    expect(await updateOwnFood(testDb, alice, id, oats)).toBe(false);
    expect(await softDeleteOwnFood(testDb, alice, id)).toBe(false);
    expect(await copyFood(testDb, alice, id)).toBeNull();
    expect(await addPortion(testDb, alice, id, { label: "1 шт", grams: 50 })).toBe("not_found");
    expect(await listVisiblePortions(testDb, alice, id)).toEqual([]);
  });

  it("lists own foods newest first", async () => {
    const alice = await newUserId("alice@mail.com");
    await createFood(testDb, alice, { ...oats, name: "Первый" });
    await createFood(testDb, alice, { ...oats, name: "Второй" });
    await insertSharedFood({ name: "Гречка" });
    const names = (await listOwnFoods(testDb, alice, 20)).map((food) => food.name);
    expect(names).toEqual(["Второй", "Первый"]);
  });
});

describe("copyFood", () => {
  it("copies a shared food with all visible portions as the user's own", async () => {
    const alice = await newUserId("alice@mail.com");
    const shared = await insertSharedFood({ name: "Яйцо", kcal100: 143, fiber100: 0 });
    await insertSharedPortion(shared, "1 шт", 50);
    await addPortion(testDb, alice, shared, { label: "моё яйцо", grams: 60 });

    const copy = await copyFood(testDb, alice, shared);
    if (!copy) throw new Error("no copy");
    const food = await getVisibleFood(testDb, alice, copy.id);
    expect(food).toMatchObject({
      name: "Яйцо",
      kcal100: 143,
      fiber100: 0,
      source: "user",
      isOwn: true,
    });
    const portions = await listVisiblePortions(testDb, alice, copy.id);
    expect(portions.map((p) => [p.label, p.grams, p.isOwn])).toEqual([
      ["1 шт", 50, true],
      ["моё яйцо", 60, true],
    ]);
  });

  it("refuses to copy someone else's food", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id } = await createFood(testDb, alice, oats);
    expect(await copyFood(testDb, bob, id)).toBeNull();
  });
});

describe("portions", () => {
  it("shows shared portions to everyone and personal ones only to their owner", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const shared = await insertSharedFood({ name: "Яйцо" });
    await insertSharedPortion(shared, "1 шт", 50);
    expect(await addPortion(testDb, alice, shared, { label: "моя порция", grams: 120 })).toBe(
      "ok",
    );

    const forAlice = await listVisiblePortions(testDb, alice, shared);
    const forBob = await listVisiblePortions(testDb, bob, shared);
    expect(forAlice.map((p) => [p.label, p.isOwn])).toEqual([
      ["1 шт", false],
      ["моя порция", true],
    ]);
    expect(forBob.map((p) => p.label)).toEqual(["1 шт"]);
  });

  it("does not add a portion to someone else's food", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const { id } = await createFood(testDb, alice, oats);
    expect(await addPortion(testDb, bob, id, { label: "x", grams: 10 })).toBe("not_found");
  });

  it("deletes only the user's own portion", async () => {
    const alice = await newUserId("alice@mail.com");
    const bob = await newUserId("bob@mail.com");
    const shared = await insertSharedFood({ name: "Яйцо" });
    const sharedPortion = await insertSharedPortion(shared, "1 шт", 50);
    await addPortion(testDb, alice, shared, { label: "моя", grams: 60 });
    const [own] = (await listVisiblePortions(testDb, alice, shared)).filter((p) => p.isOwn);
    if (!own) throw new Error("no own portion");

    expect(await deleteOwnPortion(testDb, bob, own.id)).toBe(false);
    expect(await deleteOwnPortion(testDb, alice, sharedPortion)).toBe(false);
    expect(await deleteOwnPortion(testDb, alice, own.id)).toBe(true);
    expect((await listVisiblePortions(testDb, alice, shared)).map((p) => p.label)).toEqual([
      "1 шт",
    ]);
  });

  it("caps own portions per food", async () => {
    const alice = await newUserId("alice@mail.com");
    const shared = await insertSharedFood({ name: "Яйцо" });
    for (let i = 0; i < PORTION_LIMITS.maxOwnPerFood; i += 1) {
      expect(await addPortion(testDb, alice, shared, { label: `p${i}`, grams: 10 })).toBe("ok");
    }
    expect(await addPortion(testDb, alice, shared, { label: "extra", grams: 10 })).toBe("limit");
  });
});
