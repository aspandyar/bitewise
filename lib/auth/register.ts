import { firstFieldErrors } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { isEmailAllowed } from "./allowlist";
import type { RateLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./request";
import { credentialsSchema } from "./schema";

export type RegisterDeps = {
  allowlist: Set<string>;
  limiter: RateLimiter;
  nowMs: number;
  hashPassword(password: string): Promise<string>;
  createUser(email: string, passwordHash: string): Promise<{ id: string } | null>;
};

export type RegisterResult =
  { ok: true } | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

export async function registerUser(
  raw: unknown,
  ip: string,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  // Without a proxy-reported IP every client would share one bucket; the allowlist still gates.
  if (ip !== UNKNOWN_IP && !deps.limiter.hit(`ip:${ip}`, deps.nowMs)) {
    return { ok: false, formError: ru.auth.tooManyAttempts };
  }
  // Not allowlisted and already taken share one message, so sign-up cannot probe for accounts.
  if (!isEmailAllowed(email, deps.allowlist)) {
    return { ok: false, formError: ru.auth.registerUnavailable };
  }
  const created = await deps.createUser(email, await deps.hashPassword(password));
  return created ? { ok: true } : { ok: false, formError: ru.auth.registerUnavailable };
}
