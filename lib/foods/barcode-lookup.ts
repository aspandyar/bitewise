import type { RateLimiter } from "@/lib/auth/rate-limit";
import { loggableError } from "@/lib/log";
import { normalizeBarcode, upcEAlternative } from "./barcode";
import type { FoodHints } from "./hints";
import type { OffProduct } from "./off";
import type { FoodValues } from "./types";

export type BarcodeLookupBody =
  | { status: "found"; foodId: string }
  | { status: "not_found"; code: string; hints: FoodHints }
  | { status: "unavailable"; code: string }
  | { error: "bad_code" | "unauthorized" | "forbidden" | "rate_limited" | "server_error" };

// One key for the whole process: the budget protects their server, not one user's quota.
const OFF_LIMITER_KEY = "off";

// Kept free of Next so every branch is unit-testable; route.ts only wires request and response.
export async function handleBarcodeLookup(
  // fetchSite: the Sec-Fetch-Site header, null when the browser does not send it. typed: the
  // digits came from the manual field, not the camera.
  input: {
    userId: string | null;
    rawCode: string | null;
    nowMs: number;
    fetchSite: string | null;
    typed: boolean;
  },
  deps: {
    userLimiter: RateLimiter;
    offLimiter: RateLimiter;
    offUserLimiter: RateLimiter;
    find: (userId: string, code: string) => Promise<{ id: string; isOwn: boolean } | null>;
    fetchOff: (code: string) => Promise<OffProduct | { kind: "unavailable" }>;
    saveOff: (
      code: string,
      product: { values: FoodValues; portionGrams: number | null; sourceUrl: string },
    ) => Promise<{ id: string } | null>;
  },
): Promise<{ status: number; body: BarcodeLookupBody }> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  // A GET that writes a shared row: a link on another site must not make a signed-in user's
  // browser spend their budget and fill the cache.
  if (input.fetchSite !== null && input.fetchSite !== "same-origin") {
    return { status: 403, body: { error: "forbidden" } };
  }
  if (!deps.userLimiter.hit(input.userId, input.nowMs)) {
    return { status: 429, body: { error: "rate_limited" } };
  }
  // Checked before anything leaves the server: a typo never costs a request to their API.
  const code = input.rawCode === null ? null : normalizeBarcode(input.rawCode);
  if (!code) return { status: 400, body: { error: "bad_code" } };
  // The camera reports a UPC-E as such; only typed digits leave the format open (#114).
  const alternative = input.typed ? upcEAlternative(code) : null;
  const userId = input.userId;
  const withinBudget = () =>
    deps.offUserLimiter.hit(userId, input.nowMs) &&
    deps.offLimiter.hit(OFF_LIMITER_KEY, input.nowMs);
  try {
    for (const candidate of [code, alternative]) {
      if (!candidate) continue;
      const known = await deps.find(userId, candidate);
      if (known) return { status: 200, body: { status: "found", foodId: known.id } };
    }

    if (!withinBudget()) return { status: 200, body: { status: "unavailable", code } };
    let product = await deps.fetchOff(code);
    let productCode = code;
    // Only a clean miss tries the other reading: incomplete data is still this pack's.
    if (product.kind === "not_found" && alternative) {
      // Not "not found": the other reading was never asked, and the pack may well be there.
      if (!withinBudget()) return { status: 200, body: { status: "unavailable", code } };
      product = await deps.fetchOff(alternative);
      productCode = alternative;
      // Neither is known: the new food takes the digits the person typed.
      if (product.kind === "not_found") productCode = code;
    }
    switch (product.kind) {
      case "found": {
        const { values, portionGrams, sourceUrl } = product;
        const saved = await deps.saveOff(productCode, { values, portionGrams, sourceUrl });
        // Null: the cached product was deleted (bad data there); the code stays blocked and the
        // user makes their own food.
        if (!saved) {
          return { status: 200, body: { status: "not_found", code: productCode, hints: {} } };
        }
        return { status: 200, body: { status: "found", foodId: saved.id } };
      }
      case "incomplete":
        return {
          status: 200,
          body: { status: "not_found", code: productCode, hints: product.hints },
        };
      case "not_found":
        return { status: 200, body: { status: "not_found", code: productCode, hints: {} } };
      case "unavailable":
        return { status: 200, body: { status: "unavailable", code } };
    }
  } catch (error) {
    // The code and the product stay out of the log: what someone eats is personal (#76).
    console.error("barcode lookup failed", loggableError(error));
    return { status: 500, body: { error: "server_error" } };
  }
}
