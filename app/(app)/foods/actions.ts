"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect, RedirectType } from "next/navigation";
import { db } from "@/db/client";
import { requireActionUser, requireWriteUser } from "@/lib/auth/session";
import { FOOD_LIMITS, PORTION_LIMITS } from "@/lib/config";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import {
  addPortion,
  copyFood,
  createFood,
  deleteOwnPortion,
  deleteOwnFood,
  updateOwnFood,
} from "@/lib/foods/repo";
import { ownFoodSchema, parseFoodId, portionSchema } from "@/lib/foods/schema";
import { addFoodHref } from "@/lib/diary/paths";
import { parseEntryContext } from "@/lib/diary/schema";
import { OFF_MARK } from "@/lib/foods/hints";
import { getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { readRequestId } from "@/lib/request-id";
import { withToast } from "@/lib/toast";

// Bound arguments come from the client and can be tampered with, so ids are re-validated here.
function requireId(value: unknown): string {
  const id = parseFoodId(value);
  if (!id) notFound();
  return id;
}

export async function createFoodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const raw = Object.fromEntries(formData);
  const parsed = ownFoodSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  // The form came from a scan with Open Food Facts hints. The mark is only a credit on the
  // user's own food and only with a code, so a forged one changes nothing but that label.
  const fromOff = raw.from === OFF_MARK && parsed.data.barcode !== null;
  const created = await createFood(db, userId, parsed.data, {
    copiedFrom: fromOff ? "off" : null,
    requestId: readRequestId(formData),
  });
  if (created === "limit") return { formError: ru.foods.foodLimit(FOOD_LIMITS.maxOwnFoods) };
  if (created === "barcode_taken") return { fieldErrors: { barcode: ru.foods.barcodeTaken } };
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
  const userId = await requireActionUser(formData);
  const id = requireId(foodId);
  const parsed = ownFoodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const updated = await updateOwnFood(db, userId, id, parsed.data);
  if (updated === "barcode_taken") return { fieldErrors: { barcode: ru.foods.barcodeTaken } };
  if (!updated) notFound();
  redirect(withToast(`/foods/${id}`, "saved"));
}

export async function deleteFoodAction(foodId: string): Promise<void> {
  const userId = await requireWriteUser();
  const id = requireId(foodId);
  const deleted = await deleteOwnFood(db, userId, id);
  // Drops the client's cached food screen, so browser Back renders "not found" instead of a food
  // that still looks editable.
  revalidatePath(`/foods/${id}`);
  // Nothing deleted: a replay of a delete that already went through (#95) — or an id that is not
  // the user's; both go back to the list, without the toast.
  redirect(deleted ? withToast("/foods", "deleted") : "/foods");
}

export async function copyFoodAction(foodId: string, formData?: FormData): Promise<void> {
  const userId = await requireActionUser(formData);
  const copy = await copyFood(db, userId, requireId(foodId), readRequestId(formData));
  if (!copy) notFound();
  // The copy button has no form state to show a message in; reaching the cap means a script,
  // not a person, so the generic error screen is enough.
  if (copy === "limit") throw new Error("own food cap reached");
  // Replace, not push: Back from the copy must not land on the shared card with its copy button
  // again, one tap away from a second copy (#88).
  redirect(withToast(`/foods/${copy.id}/edit`, "copied"), RedirectType.replace);
}

export async function addPortionAction(
  foodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const id = requireId(foodId);
  const parsed = portionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await addPortion(db, userId, id, parsed.data, readRequestId(formData));
  if (result === "not_found") notFound();
  if (result === "limit") return { formError: ru.foods.portionLimit(PORTION_LIMITS.maxOwnPerFood) };
  revalidatePath(`/foods/${id}`);
  return { ok: true };
}

export async function deletePortionAction(foodId: string, portionId: string): Promise<void> {
  const userId = await requireWriteUser();
  const id = requireId(foodId);
  // Nothing deleted is a replay (#95) or a stale list: either way the food screen just refreshes.
  await deleteOwnPortion(db, userId, id, requireId(portionId));
  revalidatePath(`/foods/${id}`);
}
