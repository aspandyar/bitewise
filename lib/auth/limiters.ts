import { RATE_LIMITS } from "@/lib/config";
import { createRateLimiter } from "./rate-limit";

// Module-level singletons: one counter per server process.
export const loginLimiter = createRateLimiter(RATE_LIMITS.login);
export const registerLimiter = createRateLimiter(RATE_LIMITS.register);
export const writeLimiter = createRateLimiter(RATE_LIMITS.write);
export const passwordChangeLimiter = createRateLimiter(RATE_LIMITS.passwordChange);
