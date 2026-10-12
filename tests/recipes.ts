import { recipes } from "@/db/schema";
import { testDb } from "./db";
import { createOwnFood } from "./foods";

// A bare recipe row for food-level tests that do not go through lib/recipes.
export async function insertRecipeFood(
  userId: string,
  name: string,
): Promise<{ foodId: string; recipeId: string }> {
  const food = await createOwnFood(userId, {
    name,
    kcal100: 0,
    protein100: 0,
    fat100: 0,
    carbs100: 0,
    fiber100: null,
  });
  const [row] = await testDb
    .insert(recipes)
    .values({ userId, foodId: food.id })
    .returning({ id: recipes.id });
  if (!row) throw new Error("recipe not inserted");
  return { foodId: food.id, recipeId: row.id };
}
