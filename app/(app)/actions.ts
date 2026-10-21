"use server";

import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { changePassword, type ChangePasswordResult } from "@/lib/auth/change-password";
import { passwordChangeLimiter } from "@/lib/auth/limiters";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireAccountUser, requireActionUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/date";
import { firstFieldErrors, type FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { resetTargetToAuto, saveProfile } from "@/lib/profile/repo";
import { makeProfileSchema } from "@/lib/profile/schema";
import { setManualTarget } from "@/lib/targets/repo";
import { targetsSchema } from "@/lib/targets/schema";
import {
  bumpTokenVersion,
  findAuthState,
  findPasswordHash,
  updatePasswordHash,
} from "@/lib/users/repo";

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

// A form too (KeyedForm): it is bound to no id, so a replay under another account would reset
// that account's target (#107).
export async function resetTargetAction(formData?: FormData): Promise<void> {
  const userId = await requireActionUser(formData);
  const reset = await resetTargetToAuto(db, userId, todayIsoDate(new Date()));
  redirect(reset ? "/" : "/onboarding");
}

// Every other session ends with the old password (#29); the form signs this device in again.
export async function changePasswordAction(formData: FormData): Promise<ChangePasswordResult> {
  const userId = await requireAccountUser(formData);
  const state = await findAuthState(db, userId);
  if (!state) return { ok: false, formError: ru.auth.wrongCurrentPassword };
  const account = { id: userId, tokenVersion: state.tokenVersion };
  return changePassword(Object.fromEntries(formData), account, {
    limiter: passwordChangeLimiter,
    nowMs: Date.now(),
    findPasswordHash: (id) => findPasswordHash(db, id),
    verifyPassword,
    hashPassword,
    updatePasswordHash: (id, passwordHash) => updatePasswordHash(db, id, passwordHash),
  });
}

// Ends every session of the account, this one included; the button signs out right after (#29).
export async function signOutEverywhereAction(formData?: FormData): Promise<void> {
  const userId = await requireAccountUser(formData);
  await bumpTokenVersion(db, userId);
}
