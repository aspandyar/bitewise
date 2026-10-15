"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect, RedirectType } from "next/navigation";
import { db } from "@/db/client";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_LIMITS, PORTION_LIMITS } from "@/lib/config";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import {
  addPortion,
  copyFood,
  createFood,
  deleteOwnPortion,
  softDeleteOwnFood,
  updateOwnFood,
} from "@/lib/foods/repo";
import { foodSchema, parseFoodId, portionSchema } from "@/lib/foods/schema";
import { addFoodHref } from "@/lib/diary/paths";
import { parseEntryContext } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { withToast } from "@/lib/toast";

// Bound arguments come from the client and can be tampered with, so ids are re-validated here.
function requireId(value: unknown): string {
  const id = parseFoodId(value);
  if (!id) notFound();
  return id;
}

export async function createFoodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData);
  const parsed = foodSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const created = await createFood(db, userId, parsed.data);
  if (created === "limit") return { formError: ru.foods.foodLimit(FOOD_LIMITS.maxOwnFoods) };
  // Started from the diary search: back to logging it, not to the food card. The form's history
  // entry is replaced, so system Back cannot reopen it and save the same food twice.
  const entry = parseEntryContext(raw.date, raw.meal, await getUserToday(new Date()));
  if (entry) {
    redirect(
      withToast(addFoodHref(created.id, entry.date, entry.meal), "saved"),
      RedirectType.replace,
    );
  }
  redirect(withToast(`/foods/${created.id}`, "saved"), RedirectType.replace);
}

export async function updateFoodAction(
  foodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(foodId);
  const parsed = foodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  if (!(await updateOwnFood(db, userId, id, parsed.data))) notFound();
  redirect(withToast(`/foods/${id}`, "saved"));
}

export async function deleteFoodAction(foodId: string): Promise<void> {
  const userId = await requireUserId();
  const id = requireId(foodId);
  if (!(await softDeleteOwnFood(db, userId, id))) notFound();
  // Drops the client's cached food screen, so browser Back renders "not found" instead of a food
  // that still looks editable.
  revalidatePath(`/foods/${id}`);
  redirect(withToast("/foods", "deleted"));
}

export async function copyFoodAction(foodId: string): Promise<void> {
  const userId = await requireUserId();
  const copy = await copyFood(db, userId, requireId(foodId));
  if (!copy) notFound();
  // The copy button has no form state to show a message in; reaching the cap means a script,
  // not a person, so the generic error screen is enough.
  if (copy === "limit") throw new Error("own food cap reached");
  redirect(withToast(`/foods/${copy.id}/edit`, "copied"));
}

export async function addPortionAction(
  foodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(foodId);
  const parsed = portionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await addPortion(db, userId, id, parsed.data);
  if (result === "not_found") notFound();
  if (result === "limit") return { formError: ru.foods.portionLimit(PORTION_LIMITS.maxOwnPerFood) };
  revalidatePath(`/foods/${id}`);
  return { ok: true };
}

export async function deletePortionAction(foodId: string, portionId: string): Promise<void> {
  const userId = await requireUserId();
  const id = requireId(foodId);
  if (!(await deleteOwnPortion(db, userId, id, requireId(portionId)))) notFound();
  revalidatePath(`/foods/${id}`);
}
