"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireActionUser, requireWriteUser } from "@/lib/auth/session";
import { parseDiaryDate } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { withToast } from "@/lib/toast";
import { BODY_HREF } from "@/lib/weight/paths";
import { deleteWeight, saveWeight } from "@/lib/weight/repo";
import { weightFormSchema } from "@/lib/weight/schema";

// The date is a bound argument from the page (today, or the weigh-in being edited).
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
  await saveWeight(db, userId, { date, weightKg: parsed.data.weightKg }, today);
  redirect(withToast(BODY_HREF, "saved"));
}

// A replayed, foreign or missing day deletes nothing and lands where a real delete does.
export async function deleteWeightAction(rawDate: string): Promise<void> {
  const userId = await requireWriteUser();
  const today = await getUserToday(new Date());
  const date = parseDiaryDate(rawDate, today);
  if (date) await deleteWeight(db, userId, date, today);
  redirect(withToast(BODY_HREF, "deleted"));
}
