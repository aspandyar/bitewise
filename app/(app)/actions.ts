"use server";

import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireActionUser, requireUserId } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/date";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { resetTargetToAuto, saveProfile } from "@/lib/profile/repo";
import { makeProfileSchema } from "@/lib/profile/schema";
import { setManualTarget } from "@/lib/targets/repo";
import { targetsSchema } from "@/lib/targets/schema";

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const today = todayIsoDate(new Date());
  const parsed = makeProfileSchema(today).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  await saveProfile(db, userId, parsed.data, today);
  redirect("/");
}

export async function saveManualTargetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireActionUser(formData);
  const parsed = targetsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error) };
  await setManualTarget(db, userId, parsed.data);
  redirect("/");
}

export async function resetTargetAction(): Promise<void> {
  const userId = await requireUserId();
  const reset = await resetTargetToAuto(db, userId, todayIsoDate(new Date()));
  redirect(reset ? "/" : "/onboarding");
}
