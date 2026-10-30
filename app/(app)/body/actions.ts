"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireActionUser, requireWriteUser } from "@/lib/auth/session";
import { parseDiaryDate, parseId } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { readRequestId } from "@/lib/request-id";
import { withToast } from "@/lib/toast";
import { BODY_HREF } from "@/lib/weight/paths";
import { deleteWeight, saveWeight, updateWeight } from "@/lib/weight/repo";
import { weightFormSchema } from "@/lib/weight/schema";

// Today's weigh-in: the date is a bound argument from the page.
export async function saveWeightAction(
  rawDate: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const today = await getUserToday(new Date());
  const date = parseDiaryDate(rawDate, today);
  if (!date) notFound();
  const parsed = weightFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const requestId = readRequestId(formData);
  await saveWeight(db, userId, { date, weightKg: parsed.data.weightKg, requestId }, today);
  redirect(withToast(BODY_HREF, "saved"));
}

// An existing weigh-in, by its id: one deleted since (Back to a stale edit screen) is not re-created.
export async function updateWeightAction(
  entryId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const id = parseId(entryId);
  if (!id) notFound();
  const parsed = weightFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  const today = await getUserToday(new Date());
  const updated = await updateWeight(db, userId, id, parsed.data.weightKg, today);
  redirect(withToast(BODY_HREF, updated ? "saved" : "weightGone"));
}

// A replayed, foreign or missing id deletes nothing and lands where a real delete does.
export async function deleteWeightAction(entryId: string): Promise<void> {
  const userId = await requireWriteUser();
  const today = await getUserToday(new Date());
  const id = parseId(entryId);
  if (id) await deleteWeight(db, userId, id, today);
  redirect(withToast(BODY_HREF, "deleted"));
}
