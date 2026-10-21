"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { appearanceSchema } from "@/lib/appearance";
import { requireActionUser, requireUserId } from "@/lib/auth/session";
import { APPEARANCE } from "@/lib/config";
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

// The choice lives on the device, not the account (decision 2026-10-13); the head script reads it,
// so the cookie cannot be httpOnly. It holds no secret.
export async function saveAppearanceAction(input: unknown): Promise<void> {
  await requireUserId();
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return;
  const store = await cookies();
  const options = {
    path: "/",
    maxAge: APPEARANCE.maxAgeSec,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  } as const;
  store.set(APPEARANCE.cookies.theme, parsed.data.theme, options);
  store.set(APPEARANCE.cookies.accent, parsed.data.accent, options);
}
