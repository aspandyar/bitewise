import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FOOD_SEARCH } from "@/lib/config";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createOwnFood, insertSharedFood, newUserId } from "@/tests/foods";
import { insertRecipeFood } from "@/tests/recipes";
import { createFood, searchFoods, softDeleteOwnFood } from "./repo";
import { normalizeFoodQuery } from "./search";

const values = { kcal100: 100, protein100: 1, fat100: 1, carbs100: 1, fiber100: null };

async function names(userId: string, raw: string): Promise<string[]> {
  const query = normalizeFoodQuery(raw);
  if (!query) throw new Error(`bad query ${raw}`);
  return (await searchFoods(testDb, userId, query)).map((food) => food.name);
}

let alice: string;

beforeEach(async () => {
  await resetDb();
  alice = await newUserId("alice@mail.com");
  for (const name of [
    "Гречка, крупа сухая",
    "Гречка варёная",
    "Говядина, вырезка сырая",
    "Грейпфрут",
    "Свёкла варёная",
    "Молоко 3,2 %",
    "Хлеб ржаной",
  ]) {
    await insertSharedFood({ name });
  }
});
afterAll(closeTestDb);

describe("searchFoods", () => {
  it("finds buckwheat by its first one and two letters", async () => {
    expect(await names(alice, "г")).toEqual(
      expect.arrayContaining(["Гречка, крупа сухая", "Гречка варёная"]),
    );
    const gr = await names(alice, "гр");
    expect(gr).toHaveLength(3);
    expect(gr).toEqual(
      expect.arrayContaining(["Грейпфрут", "Гречка варёная", "Гречка, крупа сухая"]),
    );
  });

  it("matches the start of any word, not the middle of one", async () => {
    expect(await names(alice, "кр")).toEqual(["Гречка, крупа сухая"]);
    expect(await names(alice, "еч")).toEqual([]);
  });

  it("tolerates a typo from three letters on", async () => {
    expect(await names(alice, "гречко")).toEqual(
      expect.arrayContaining(["Гречка, крупа сухая", "Гречка варёная"]),
    );
    expect(await names(alice, "грчка")).toEqual(expect.arrayContaining(["Гречка варёная"]));
  });

  it("does not return unrelated foods for a typo", async () => {
    expect(await names(alice, "гречко")).not.toContain("Молоко 3,2 %");
  });

  it("ranks the closer word first among equal prefix matches", async () => {
    await insertSharedFood({ name: "Греческий йогурт 0 %" });
    const found = await names(alice, "греч");
    expect(found.indexOf("Гречка варёная")).toBeLessThan(found.indexOf("Греческий йогурт 0 %"));
  });

  it("does not match a short query to a word that only shares a few letters", async () => {
    await insertSharedFood({ name: "Перец болгарский красный" });
    await insertSharedFood({ name: "Сыр рикотта" });
    expect(await names(alice, "борщ")).toEqual([]);
    expect(await names(alice, "рис")).toEqual([]);
  });

  it("finds a misspelt word but not its look-alikes", async () => {
    await insertSharedFood({ name: "Малина" });
    expect(await names(alice, "малоко")).toEqual(["Молоко 3,2 %"]);
  });

  it("finds ё-words when typed with е", async () => {
    expect(await names(alice, "свекла")).toEqual(["Свёкла варёная"]);
    expect(await names(alice, "варен")).toEqual(
      expect.arrayContaining(["Гречка варёная", "Свёкла варёная"]),
    );
  });

  it("puts the user's own foods first", async () => {
    await createFood(testDb, alice, { ...values, name: "Гречневые хлопья" });
    const [first] = await searchFoods(testDb, alice, "греч");
    expect(first).toMatchObject({ name: "Гречневые хлопья", isOwn: true, source: "user" });
  });

  it("never shows another user's or a deleted food", async () => {
    const bob = await newUserId("bob@mail.com");
    const { id } = await createOwnFood(bob, { ...values, name: "Гречка Боба" });
    expect(await names(alice, "гречка")).not.toContain("Гречка Боба");
    await softDeleteOwnFood(testDb, bob, id);
    expect(await names(bob, "гречка")).not.toContain("Гречка Боба");
  });

  it("treats LIKE wildcards literally", async () => {
    // Unescaped, "%" and "_" would become LIKE '%%' / '_%' and match every food. "%" does
    // legitimately start a word in "Молоко 3,2 %", so that one food is the only match.
    expect(await names(alice, "%")).toEqual(["Молоко 3,2 %"]);
    expect(await names(alice, "_")).toEqual([]);
    expect(await names(alice, "\\")).toEqual([]);
    expect(await names(alice, "молоко 3,2 %")).toEqual(["Молоко 3,2 %"]);
  });

  it("caps the number of results", async () => {
    for (let i = 0; i < FOOD_SEARCH.limit + 5; i += 1) {
      await createFood(testDb, alice, { ...values, name: `Гриб ${i}` });
    }
    expect(await searchFoods(testDb, alice, "гриб")).toHaveLength(FOOD_SEARCH.limit);
  });

  it("returns list fields only, without owner ids", async () => {
    const [item] = await searchFoods(testDb, alice, "грейпфрут");
    expect(Object.keys(item ?? {}).sort()).toEqual(
      [
        "carbs100",
        "fat100",
        "id",
        "isOwn",
        "isRecipe",
        "kcal100",
        "name",
        "protein100",
        "source",
      ].sort(),
    );
  });
});

describe("searchFoods and recipes", () => {
  it("marks only recipes as recipes", async () => {
    await insertRecipeFood(alice, "Гречневая каша с маслом");
    const items = await searchFoods(testDb, alice, "греч");
    const byName = Object.fromEntries(items.map((food) => [food.name, food.isRecipe]));
    expect(byName).toMatchObject({
      "Гречневая каша с маслом": true,
      "Гречка варёная": false,
      "Гречка, крупа сухая": false,
    });
  });

  it("hides recipes when asked", async () => {
    await insertRecipeFood(alice, "Гречневая каша с маслом");
    const items = await searchFoods(testDb, alice, "греч", { excludeRecipes: true });
    expect(items.map((food) => food.name)).not.toContain("Гречневая каша с маслом");
    expect(items.length).toBeGreaterThan(0);
  });
});
