import { writeLimiter } from "./limiters";
import type { RateLimiter } from "./rate-limit";

// Keyed by the account, not the IP: the session already names who writes, and one phone on a
// shared network must not slow down another.
export function allowWrite(userId: string, nowMs: number, limiter: RateLimiter = writeLimiter): boolean {
  return limiter.hit(`user:${userId}`, nowMs);
}
