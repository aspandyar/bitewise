import type { RateLimiter } from "@/lib/auth/rate-limit";
import { loggableError } from "@/lib/log";
import { normalizeBarcode } from "./barcode";
import type { FoodHints, OffProduct } from "./off";
import type { FoodValues } from "./types";

export type BarcodeLookupBody =
  | { status: "found"; foodId: string }
  | { status: "not_found"; code: string; hints: FoodHints }
  | { status: "unavailable"; code: string }
  | { error: "bad_code" | "unauthorized" | "rate_limited" | "server_error" };

// One key for the whole process: the budget protects their server, not one user's quota.
const OFF_LIMITER_KEY = "off";

// Kept free of Next so every branch is unit-testable; route.ts only wires request and response.
export async function handleBarcodeLookup(
  input: { userId: string | null; rawCode: string | null; nowMs: number },
  deps: {
    userLimiter: RateLimiter;
    offLimiter: RateLimiter;
    find: (userId: string, code: string) => Promise<{ id: string; isOwn: boolean } | null>;
    fetchOff: (code: string) => Promise<OffProduct | { kind: "unavailable" }>;
    saveOff: (
      code: string,
      product: { values: FoodValues; portionGrams: number | null; sourceUrl: string },
    ) => Promise<{ id: string }>;
  },
): Promise<{ status: number; body: BarcodeLookupBody }> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  if (!deps.userLimiter.hit(input.userId, input.nowMs)) {
    return { status: 429, body: { error: "rate_limited" } };
  }
  // Checked before anything leaves the server: a typo never costs a request to their API.
  const code = input.rawCode === null ? null : normalizeBarcode(input.rawCode);
  if (!code) return { status: 400, body: { error: "bad_code" } };
  try {
    const known = await deps.find(input.userId, code);
    if (known) return { status: 200, body: { status: "found", foodId: known.id } };

    if (!deps.offLimiter.hit(OFF_LIMITER_KEY, input.nowMs)) {
      return { status: 200, body: { status: "unavailable", code } };
    }
    const product = await deps.fetchOff(code);
    switch (product.kind) {
      case "found": {
        const { values, portionGrams, sourceUrl } = product;
        const saved = await deps.saveOff(code, { values, portionGrams, sourceUrl });
        return { status: 200, body: { status: "found", foodId: saved.id } };
      }
      case "incomplete":
        return { status: 200, body: { status: "not_found", code, hints: product.hints } };
      case "not_found":
        return { status: 200, body: { status: "not_found", code, hints: {} } };
      case "unavailable":
        return { status: 200, body: { status: "unavailable", code } };
    }
  } catch (error) {
    // The code and the product stay out of the log: what someone eats is personal (#76).
    console.error("barcode lookup failed", loggableError(error));
    return { status: 500, body: { error: "server_error" } };
  }
}
