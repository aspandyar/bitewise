import { z } from "zod";
import { AUTH } from "@/lib/config";
import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { RateLimiter } from "./rate-limit";
import { passwordSchema } from "./schema";
import { BusyError } from "./semaphore";

export type ChangePasswordDeps = {
  limiter: RateLimiter;
  nowMs: number;
  findPasswordHash(userId: string): Promise<{ email: string; passwordHash: string } | null>;
  verifyPassword(password: string, stored: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
};

export type ChangePasswordResult =
  | { ok: true; email: string }
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

const changePasswordSchema = z.object({
  // Any length that could have been set: only the new one follows today's rules.
  currentPassword: z
    .string({ error: ru.auth.wrongCurrentPassword })
    .min(1, { error: ru.auth.wrongCurrentPassword })
    .max(AUTH.passwordLength.max, { error: ru.auth.wrongCurrentPassword }),
  newPassword: passwordSchema,
});

// The new hash bumps the token version (updatePasswordHash), so every other session ends (#29);
// the caller signs this device in again with the email returned here.
export async function changePassword(
  raw: unknown,
  userId: string,
  deps: ChangePasswordDeps,
): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { currentPassword, newPassword } = parsed.data;
  if (newPassword === currentPassword) {
    return { ok: false, fieldErrors: { newPassword: ru.auth.samePassword } };
  }
  // A stolen session must not turn into unlimited guesses at the password it does not know.
  if (!deps.limiter.hit(`user:${userId}`, deps.nowMs)) {
    return { ok: false, formError: ru.auth.tooManyAttempts };
  }
  try {
    const user = await deps.findPasswordHash(userId);
    if (!user || !(await deps.verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, fieldErrors: { currentPassword: ru.auth.wrongCurrentPassword } };
    }
    await deps.updatePasswordHash(userId, await deps.hashPassword(newPassword));
    return { ok: true, email: user.email };
  } catch (error) {
    if (error instanceof BusyError) return { ok: false, formError: ru.auth.tooManyAttempts };
    throw error;
  }
}
