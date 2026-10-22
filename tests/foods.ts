import { foodPortions, foods } from "@/db/schema";
import type { FoodValues } from "@/lib/foods/types";
import { createFood } from "@/lib/foods/repo";
import { createUser } from "@/lib/users/repo";
import { testDb } from "./db";

export async function newUserId(email: string): Promise<string> {
  const user = await createUser(testDb, { email, passwordHash: "h" });
  if (!user) throw new Error(`user ${email} not created`);
  return user.id;
}

// Shared foods normally come from the seed; tests insert them directly with a unique key.
export async function insertSharedFood(
  values: Partial<FoodValues> & { name: string; key?: string },
): Promise<string> {
  const [row] = await testDb
    .insert(foods)
    .values({
      name: values.name,
      kcal100: values.kcal100 ?? 100,
      protein100: values.protein100 ?? 1,
      fat100: values.fat100 ?? 1,
      carbs100: values.carbs100 ?? 1,
      fiber100: values.fiber100 ?? null,
      source: "usda",
      seedKey: values.key ?? `usda:${values.name}`,
    })
    .returning({ id: foods.id });
  if (!row) throw new Error("food not inserted");
  return row.id;
}

export async function insertSharedPortion(
  foodId: string,
  label: string,
  grams: number,
): Promise<string> {
  const [row] = await testDb
    .insert(foodPortions)
    .values({ foodId, userId: null, label, grams })
    .returning({ id: foodPortions.id });
  if (!row) throw new Error("portion not inserted");
  return row.id;
}

// For tests that need an own food and are not about the per-user cap.
export async function createOwnFood(userId: string, values: FoodValues): Promise<{ id: string }> {
  const created = await createFood(testDb, userId, values);
  if (typeof created === "string") throw new Error(`own food not created in a test: ${created}`);
  return created;
}
