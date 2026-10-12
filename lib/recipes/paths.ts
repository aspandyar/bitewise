export const RECIPES_HREF = "/recipes";
export const NEW_RECIPE_HREF = "/recipes/new";

export function recipeHref(recipeId: string): string {
  return `/recipes/${recipeId}`;
}

export function recipeEditHref(recipeId: string): string {
  return `/recipes/${recipeId}/edit`;
}

export function ingredientSearchHref(recipeId: string): string {
  return `/recipes/${recipeId}/add`;
}

// FoodSearch appends the food id to this prefix.
export function ingredientAmountPrefix(recipeId: string): string {
  return `/recipes/${recipeId}/add/`;
}

export function ingredientEditHref(recipeId: string, itemId: string): string {
  return `/recipes/${recipeId}/items/${itemId}/edit`;
}
