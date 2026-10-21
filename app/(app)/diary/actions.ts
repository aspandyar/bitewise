"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { requireActionUser, requireUserId } from "@/lib/auth/session";
import { DIARY_LIMITS } from "@/lib/config";
import { addFoodHref, addHref, dayHref } from "@/lib/diary/paths";
import { quickEntryFormSchema } from "@/lib/diary/quick-entry";
import { quickAddEntry, repeatMeal, setFavorite } from "@/lib/diary/quick-repo";
import {
  addEntry,
  addQuickEntry,
  deleteEntry,
  deleteOwnEntries,
  updateEntry,
  updateQuickEntry,
} from "@/lib/diary/repo";
import {
  addEntryFormSchema,
  mealSchema,
  parseDiaryDate,
  parseId,
  parseMeal,
  toAddAmount,
  toUpdateAmount,
  updateEntryFormSchema,
} from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { recipeHref } from "@/lib/recipes/paths";
import { readRequestId } from "@/lib/request-id";
import { getRecipeIdByFoodId } from "@/lib/recipes/repo";
import { withToast } from "@/lib/toast";

// Bound arguments and hidden fields come from the client and can be tampered with.
function requireId(value: unknown): string {
  const id = parseId(value);
  if (!id) notFound();
  return id;
}

const portionTotalError: FormState = {
  fieldErrors: {
    count: ru.errors.portionTotalGrams(DIARY_LIMITS.grams.min, DIARY_LIMITS.grams.max),
  },
};

export async function addEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const today = await getUserToday(new Date());
  const raw = Object.fromEntries(formData);
  const date = parseDiaryDate(raw.date, today);
  if (!date) notFound();
  const foodId = requireId(raw.foodId);
  const parsed = addEntryFormSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const result = await addEntry(db, userId, {
    date,
    meal: parsed.data.meal,
    foodId,
    amount: toAddAmount(parsed.data),
    requestId: readRequestId(formData),
  });
  if (result === "not_found") notFound();
  if (result === "grams_out_of_range") return portionTotalError;
  if (result === "limit") return { formError: ru.diary.entryLimit(DIARY_LIMITS.maxEntriesPerDay) };
  if (result === "total_limit") {
    return { formError: ru.diary.entryTotalLimit(DIARY_LIMITS.maxEntriesTotal) };
  }
  redirect(dayHref(date, today));
}

export async function updateEntryAction(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const id = requireId(entryId);
  const parsed = updateEntryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const updated = await updateEntry(db, userId, id, {
    meal: parsed.data.meal,
    amount: toUpdateAmount(parsed.data),
  });
  if (!updated) notFound();
  if (updated === "grams_out_of_range") return portionTotalError;
  redirect(dayHref(updated.date, await getUserToday(new Date())));
}

// rawDate is the entry's day from the edit page: a replayed delete (#95) finds nothing left and
// still lands on that day, as the first one did. A missing or foreign id ends there too.
export async function deleteEntryAction(entryId: string, rawDate: string): Promise<void> {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const deleted = await deleteEntry(db, userId, requireId(entryId));
  redirect(dayHref(deleted?.date ?? parseDiaryDate(rawDate, today) ?? today, today));
}

// Date and meal arrive as bound arguments from the page; both are re-validated here.
async function requireDayAndMeal(rawDate: unknown, rawMeal: unknown) {
  const today = await getUserToday(new Date());
  const date = parseDiaryDate(rawDate, today);
  const meal = parseMeal(rawMeal);
  if (!date || !meal) notFound();
  return { today, date, meal };
}

export async function quickAddAction(
  foodId: string,
  rawDate: string,
  rawMeal: string,
  formData?: FormData,
): Promise<void> {
  const userId = await requireActionUser(formData);
  const { today, date, meal } = await requireDayAndMeal(rawDate, rawMeal);
  const id = requireId(foodId);
  const requestId = readRequestId(formData);
  const result = await quickAddEntry(db, userId, { date, meal, foodId: id, requestId });
  // A cached add screen can still list a food deleted since: say so there, not with a 404.
  if (result === "not_found") redirect(addHref(date, meal, "gone"));
  // A favorite never logged has no amount to repeat: it gets the regular amount screen.
  if (result === "no_amount") redirect(addFoodHref(id, date, meal));
  if (result === "limit") redirect(addHref(date, meal, "limit"));
  if (result === "total_limit") redirect(addHref(date, meal, "totalLimit"));
  redirect(withToast(dayHref(date, today), "added", [result.id]));
}

export async function repeatMealAction(
  rawDate: string,
  rawMeal: string,
  formData?: FormData,
): Promise<void> {
  const userId = await requireActionUser(formData);
  const { today, date, meal } = await requireDayAndMeal(rawDate, rawMeal);
  const requestId = readRequestId(formData);
  const result = await repeatMeal(db, userId, { date, meal, requestId });
  // The repeat button lives on the day, so every outcome returns there with its message.
  if (result === "not_empty") redirect(withToast(dayHref(date, today), "alreadyFilled"));
  // A key already spent on another meal: a tampered request, it just returns to the day.
  if (result === "nothing" || result === "not_found") redirect(dayHref(date, today));
  if (result === "limit" || result === "total_limit") {
    redirect(withToast(dayHref(date, today), "dayFull"));
  }
  redirect(withToast(dayHref(date, today), "addedMany", result.ids));
}

const undoSchema = z.array(z.uuid()).min(1).max(DIARY_LIMITS.maxEntriesPerDay);

// Called from the toast; ids are the ones the URL carried, so only the user's own are deleted.
export async function undoAddAction(ids: unknown): Promise<void> {
  const userId = await requireUserId();
  const parsed = undoSchema.safeParse(ids);
  if (!parsed.success) return;
  await deleteOwnEntries(db, userId, parsed.data);
  revalidatePath("/");
}

export async function addQuickEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const raw = Object.fromEntries(formData);
  const { today, date } = await requireDayAndMeal(raw.date, raw.meal);
  const parsed = z.object({ meal: mealSchema }).and(quickEntryFormSchema).safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const { meal, ...values } = parsed.data;
  const result = await addQuickEntry(db, userId, {
    date,
    meal,
    values,
    requestId: readRequestId(formData),
  });
  // A request key already used for another entry: a tampered request, not a person.
  if (result === "not_found") notFound();
  if (result === "limit") return { formError: ru.diary.entryLimit(DIARY_LIMITS.maxEntriesPerDay) };
  if (result === "total_limit") {
    return { formError: ru.diary.entryTotalLimit(DIARY_LIMITS.maxEntriesTotal) };
  }
  redirect(withToast(dayHref(date, today), "added", [result.id]));
}

export async function updateQuickEntryAction(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const id = requireId(entryId);
  const parsed = z
    .object({ meal: mealSchema })
    .and(quickEntryFormSchema)
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const { meal, ...values } = parsed.data;
  const updated = await updateQuickEntry(db, userId, id, { meal, values });
  if (!updated) notFound();
  redirect(withToast(dayHref(updated.date, await getUserToday(new Date())), "saved"));
}

// The star sends the state it should end in, not "toggle": a replay must not undo it (#95).
export async function setFavoriteAction(foodId: string, starred: unknown): Promise<void> {
  const userId = await requireUserId();
  const id = requireId(foodId);
  const wanted = z.boolean().safeParse(starred);
  if (!wanted.success) notFound();
  const result = await setFavorite(db, userId, id, wanted.data);
  if (result === "not_found") notFound();
  // The cap is far above real use; reaching it means a script, and the star simply stays off.
  revalidatePath(`/foods/${id}`);
  const recipeId = await getRecipeIdByFoodId(db, userId, id);
  if (recipeId) revalidatePath(recipeHref(recipeId));
  revalidatePath("/diary/add");
}
