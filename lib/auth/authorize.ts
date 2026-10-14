import type { UserRole } from "@/lib/config";
import { loggableError } from "@/lib/log";
import type { RateLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./request";
import { credentialsSchema } from "./schema";

export type AuthorizeDeps = {
  findUserByEmail(
    email: string,
  ): Promise<{ id: string; passwordHash: string; role: UserRole } | null>;
  verifyPassword(password: string, stored: string): Promise<boolean>;
  getDummyPasswordHash(): Promise<string>;
  limiter: RateLimiter;
  nowMs: number;
};

// Every failure returns null so the caller shows one message and leaks nothing about why.
export async function authorizeCredentials(
  raw: unknown,
  ip: string,
  deps: AuthorizeDeps,
): Promise<{ id: string; email: string; role: UserRole } | null> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  // Clients without a proxy-reported IP would all share one bucket, so they skip this limit.
  if (ip !== UNKNOWN_IP && !deps.limiter.hit(`ip:${ip}`, deps.nowMs)) return null;

  try {
    const user = await deps.findUserByEmail(email);
    // Counting only real accounts keeps junk emails from filling the limiter; the per-account
    // limit stops guessing one password from many IPs.
    const accountAllowed = user ? deps.limiter.hit(`email:${email}`, deps.nowMs) : true;
    // Always pay for one hash check, so a rate-limited or unknown account answers as slowly as a
    // real attempt and response time reveals nothing.
    const stored = user && accountAllowed ? user.passwordHash : await deps.getDummyPasswordHash();
    const passwordOk = await deps.verifyPassword(password, stored);
    return user && accountAllowed && passwordOk ? { id: user.id, email, role: user.role } : null;
  } catch (error) {
    // Auth.js would put a thrown message (DB host, port, user) into the client redirect URL.
    console.error("authorize failed", loggableError(error));
    return null;
  }
}
