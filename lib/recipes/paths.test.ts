import { describe, expect, it } from "vitest";
import {
  ingredientAmountPrefix,
  ingredientEditHref,
  ingredientSearchHref,
  recipeEditHref,
  recipeHref,
} from "./paths";

const id = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";

describe("recipe paths", () => {
  it("builds every recipe screen path", () => {
    expect(recipeHref(id)).toBe(`/recipes/${id}`);
    expect(recipeEditHref(id)).toBe(`/recipes/${id}/edit`);
    expect(ingredientSearchHref(id)).toBe(`/recipes/${id}/add`);
    expect(ingredientAmountPrefix(id)).toBe(`/recipes/${id}/add/`);
    expect(ingredientEditHref(id, itemId)).toBe(`/recipes/${id}/items/${itemId}/edit`);
  });
});
