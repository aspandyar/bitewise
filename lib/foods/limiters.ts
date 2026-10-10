import { createRateLimiter } from "@/lib/auth/rate-limit";
import { RATE_LIMITS } from "@/lib/config";

// Module-level singleton: one counter per server process, keyed by user id.
export const foodSearchLimiter = createRateLimiter(RATE_LIMITS.foodSearch);
