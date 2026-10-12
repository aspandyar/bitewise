import type { AmountColumns } from "@/lib/amount";
import type { Per100g } from "@/lib/nutrition";

// Kept free of DB imports so client components can use these types.
export type RecipeValues = { name: string; cookedWeightG: number | null; servings: number | null };

export type RecipeListItem = {
  id: string;
  name: string;
  per100g: Per100g;
  servingGrams: number | null;
};

export type RecipeItemRow = AmountColumns & {
  id: string;
  foodId: string;
  foodName: string;
  // A deleted food stays in the dish with its numbers; the page marks it.
  foodDeleted: boolean;
  per100g: Per100g;
};

export type RecipeDetails = {
  id: string;
  foodId: string;
  name: string;
  cookedWeightG: number | null;
  servings: number | null;
  // Changes with every edit of the recipe or its ingredients; keys its forms.
  updatedAt: Date;
  items: RecipeItemRow[];
};

export type RecipeWriteResult = "ok" | "not_found" | "limit" | "weight_too_low";
