import type { FoodSource } from "@/lib/config";

// Kept free of DB imports so client components can use these types.
export type FoodValues = {
  name: string;
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  fiber100: number | null;
};

export type FoodListItem = {
  id: string;
  name: string;
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  source: FoodSource;
  // Computed on the server so owner ids never leave it.
  isOwn: boolean;
  // A recipe's food row: its numbers come from the ingredients, so it is edited as a recipe.
  isRecipe: boolean;
};

export type FoodDetails = FoodListItem & { fiber100: number | null; sourceUrl: string | null };

export type PortionValues = { label: string; grams: number };

export type PortionItem = PortionValues & { id: string; isOwn: boolean };
