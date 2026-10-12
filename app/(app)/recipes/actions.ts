"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { addAmountSchema, toAddAmount, toUpdateAmount, updateAmountSchema } from "@/lib/amount";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_LIMITS, RECIPE_LIMITS } from "@/lib/config";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { RECIPES_HREF, recipeHref } from "@/lib/recipes/paths";
import {
  addItem,
  createRecipe,
  deleteItem,
  deleteRecipe,
  updateItem,
  updateRecipe,
} from "@/lib/recipes/repo";
import { recipeFormSchema } from "@/lib/recipes/schema";

// Bound arguments come from the client and can be tampered with.
function requireId(value: unknown): string {
  const id = parseId(value);
  if (!id) notFound();
  return id;
}

// The ingredient forms show amount errors at their fields; these concern the dish as a whole.
function itemFailure(result: "not_found" | "limit" | "weight_too_low"): FormState {
  if (result === "not_found") notFound();
  if (result === "limit") return { formError: ru.recipes.itemLimit(RECIPE_LIMITS.maxItems) };
  return { formError: ru.recipes.weightTooLowForItem };
}

export async function createRecipeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = recipeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const created = await createRecipe(db, userId, parsed.data);
  if (created === "limit") return { formError: ru.foods.foodLimit(FOOD_LIMITS.maxOwnFoods) };
  redirect(recipeHref(created.id));
}

export async function updateRecipeAction(
  recipeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(recipeId);
  const parsed = recipeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await updateRecipe(db, userId, id, parsed.data);
  if (result === "not_found") notFound();
  if (result === "weight_too_low") {
    return { fieldErrors: { cookedWeightG: ru.recipes.weightTooLow } };
  }
  redirect(recipeHref(id));
}

export async function deleteRecipeAction(recipeId: string): Promise<void> {
  const userId = await requireUserId();
  if (!(await deleteRecipe(db, userId, requireId(recipeId)))) notFound();
  redirect(RECIPES_HREF);
}

export async function addItemAction(
  recipeId: string,
  foodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(recipeId);
  const food = requireId(foodId);
  const parsed = addAmountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await addItem(db, userId, id, { foodId: food, amount: toAddAmount(parsed.data) });
  if (result !== "ok") return itemFailure(result);
  redirect(recipeHref(id));
}

export async function updateItemAction(
  recipeId: string,
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(recipeId);
  const item = requireId(itemId);
  const parsed = updateAmountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await updateItem(db, userId, id, item, toUpdateAmount(parsed.data));
  if (result !== "ok") return itemFailure(result);
  redirect(recipeHref(id));
}

export async function deleteItemAction(recipeId: string, itemId: string): Promise<void> {
  const userId = await requireUserId();
  const id = requireId(recipeId);
  if (!(await deleteItem(db, userId, id, requireId(itemId)))) notFound();
  redirect(recipeHref(id));
}
