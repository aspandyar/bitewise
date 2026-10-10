import type { RateLimiter } from "@/lib/auth/rate-limit";
import { normalizeFoodQuery } from "./search";
import type { FoodListItem } from "./types";

export type FoodSearchResponse =
  | { status: 200; body: { items: FoodListItem[] } }
  | {
      status: 400 | 401 | 429 | 500;
      body: { error: "bad_query" | "unauthorized" | "rate_limited" | "server_error" };
    };

// Kept free of Next so every branch is unit-testable; route.ts only wires request and response.
export async function handleFoodSearch(
  input: { userId: string | null; rawQuery: string | null; nowMs: number },
  deps: {
    limiter: RateLimiter;
    search: (userId: string, query: string) => Promise<FoodListItem[]>;
  },
): Promise<FoodSearchResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  if (!deps.limiter.hit(input.userId, input.nowMs)) {
    return { status: 429, body: { error: "rate_limited" } };
  }
  const query = normalizeFoodQuery(input.rawQuery);
  if (!query) return { status: 400, body: { error: "bad_query" } };
  try {
    return { status: 200, body: { items: await deps.search(input.userId, query) } };
  } catch (error) {
    // Details stay in server logs; the client only learns that the search failed.
    console.error("food search failed", error);
    return { status: 500, body: { error: "server_error" } };
  }
}
