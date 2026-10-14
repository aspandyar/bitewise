import { z } from "zod";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { loggableError } from "@/lib/log";
import { normalizeFoodQuery } from "./search";
import type { FoodListItem } from "./types";

export type FoodSearchResponse =
  | { status: 200; body: { items: FoodListItem[] } }
  | {
      status: 400 | 401 | 429 | 500;
      body: { error: "bad_query" | "unauthorized" | "rate_limited" | "server_error" };
    };

// Ingredient pickers hide recipes: a dish inside a dish is not supported.
const excludeSchema = z.literal("recipes").nullable();

// Kept free of Next so every branch is unit-testable; route.ts only wires request and response.
export async function handleFoodSearch(
  input: {
    userId: string | null;
    rawQuery: string | null;
    rawExclude?: string | null;
    nowMs: number;
  },
  deps: {
    limiter: RateLimiter;
    search: (
      userId: string,
      query: string,
      options: { excludeRecipes: boolean },
    ) => Promise<FoodListItem[]>;
  },
): Promise<FoodSearchResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  if (!deps.limiter.hit(input.userId, input.nowMs)) {
    return { status: 429, body: { error: "rate_limited" } };
  }
  const query = normalizeFoodQuery(input.rawQuery);
  const exclude = excludeSchema.safeParse(input.rawExclude ?? null);
  if (!query || !exclude.success) return { status: 400, body: { error: "bad_query" } };
  try {
    const items = await deps.search(input.userId, query, {
      excludeRecipes: exclude.data === "recipes",
    });
    return { status: 200, body: { items } };
  } catch (error) {
    // Details stay in server logs; the client only learns that the search failed.
    console.error("food search failed", loggableError(error));
    return { status: 500, body: { error: "server_error" } };
  }
}
