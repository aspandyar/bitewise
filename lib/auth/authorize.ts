import type { UserRole } from "@/lib/config";
import { loggableError } from "@/lib/log";
import type { RateLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./request";
import { credentialsSchema } from "./schema";
import { BusyError } from "./semaphore";

export type AuthorizeDeps = {
  findUserByEmail(
    email: string,
  ): Promise<{ id: string; passwordHash: string; role: UserRole; tokenVersion: number } | null>;
  verifyPassword(password: string, stored: string): Promise<boolean>;
  getDummyPasswordHash(): Promise<string>;
  limiter: RateLimiter;
  nowMs: number;
  // Whether the request carries a valid device mark of this account (lib/auth/device.ts).
  isTrustedDevice(account: { id: string; tokenVersion: number }): boolean;
};

// Every failure returns null so the caller shows one message and leaks nothing about why.
// "busy" (hashing queue full) is the one exception: it says nothing about the account.
export async function authorizeCredentials(
  raw: unknown,
  ip: string,
  deps: AuthorizeDeps,
): Promise<{ id: string; email: string; role: UserRole; tokenVersion: number } | null | "busy"> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  // Clients without a proxy-reported IP would all share one bucket, so they skip this limit.
  const ipKey = ip === UNKNOWN_IP ? null : `ip:${ip}`;
  if (ipKey && !deps.limiter.hit(ipKey, deps.nowMs)) return null;
  let accountKey: string | null = null;

  try {
    const user = await deps.findUserByEmail(email);
    // Counting only real accounts keeps junk emails from filling the limiter; the per-account
    // limit stops guessing one password from many IPs.
    // Browsers the account signed in from before share their own bucket: strangers guessing the
    // password use up theirs and cannot lock the owner out (#30).
    const bucket = user && deps.isTrustedDevice(user) ? `device:${email}` : `email:${email}`;
    const accountAllowed = user ? deps.limiter.hit(bucket, deps.nowMs) : true;
    if (user && accountAllowed) accountKey = bucket;
    // Always pay for one hash check, so a rate-limited or unknown account answers as slowly as a
    // real attempt and response time reveals nothing.
    const stored = user && accountAllowed ? user.passwordHash : await deps.getDummyPasswordHash();
    const passwordOk = await deps.verifyPassword(password, stored);
    return user && accountAllowed && passwordOk
      ? { id: user.id, email, role: user.role, tokenVersion: user.tokenVersion }
      : null;
  } catch (error) {
    if (error instanceof BusyError) {
      // Overload is not the client's fault: under a flood that keeps the queue full, spent
      // attempts would lock the real owner out once the flood ends.
      if (ipKey) deps.limiter.refund(ipKey, deps.nowMs);
      if (accountKey) deps.limiter.refund(accountKey, deps.nowMs);
      return "busy";
    }
    // Auth.js would put a thrown message (DB host, port, user) into the client redirect URL.
    console.error("authorize failed", loggableError(error));
    return null;
  }
}
