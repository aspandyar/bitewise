import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { RateLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./request";
import { credentialsSchema } from "./schema";

export type RegisterDeps = {
  limiter: RateLimiter;
  nowMs: number;
  hashPassword(password: string): Promise<string>;
  createUser(email: string, passwordHash: string): Promise<{ id: string } | null>;
};

export type RegisterResult =
  { ok: true } | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

// Sign-up is open to anyone and always yields the "user" role, so taking an email first grants
// no privileges; the admin account is created by the bootstrap script instead.
export async function registerUser(
  raw: unknown,
  ip: string,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  // Without a proxy-reported IP every client would share one bucket, so the limit is skipped.
  if (ip !== UNKNOWN_IP && !deps.limiter.hit(`ip:${ip}`, deps.nowMs)) {
    return { ok: false, formError: ru.auth.tooManyAttempts };
  }
  // The hash runs before the insert, so a taken email answers as slowly as a new one.
  const created = await deps.createUser(email, await deps.hashPassword(password));
  return created ? { ok: true } : { ok: false, formError: ru.auth.registerFailed };
}
