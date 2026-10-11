"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireUserId } from "@/lib/auth/session";
import { DIARY_LIMITS } from "@/lib/config";
import { dayHref } from "@/lib/diary/paths";
import { addEntry, deleteEntry, updateEntry } from "@/lib/diary/repo";
import {
  addEntryFormSchema,
  parseDiaryDate,
  parseId,
  toAddAmount,
  toUpdateAmount,
  updateEntryFormSchema,
} from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

// Bound arguments and hidden fields come from the client and can be tampered with.
function requireId(value: unknown): string {
  const id = parseId(value);
  if (!id) notFound();
  return id;
}

export async function addEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
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
  });
  if (result === "not_found") notFound();
  if (result === "limit") return { formError: ru.diary.entryLimit(DIARY_LIMITS.maxEntriesPerDay) };
  redirect(dayHref(date, today));
}

export async function updateEntryAction(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const id = requireId(entryId);
  const parsed = updateEntryFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const updated = await updateEntry(db, userId, id, {
    meal: parsed.data.meal,
    amount: toUpdateAmount(parsed.data),
  });
  if (!updated) notFound();
  redirect(dayHref(updated.date, await getUserToday(new Date())));
}

export async function deleteEntryAction(entryId: string): Promise<void> {
  const userId = await requireUserId();
  const deleted = await deleteEntry(db, userId, requireId(entryId));
  if (!deleted) notFound();
  redirect(dayHref(deleted.date, await getUserToday(new Date())));
}
