import { createRateLimiter } from "@/lib/auth/rate-limit";
import { RATE_LIMITS } from "@/lib/config";

// Module-level singleton: one counter per server process, keyed by user id.
export const foodSearchLimiter = createRateLimiter(RATE_LIMITS.foodSearch);
export const barcodeLookupLimiter = createRateLimiter(RATE_LIMITS.barcodeLookup);
export const offOutboundLimiter = createRateLimiter(RATE_LIMITS.offOutbound);
export const offOutboundPerUserLimiter = createRateLimiter(RATE_LIMITS.offOutboundPerUser);
