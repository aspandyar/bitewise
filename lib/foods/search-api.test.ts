import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { handleFoodSearch } from "./search-api";
import type { FoodListItem } from "./types";

const item: FoodListItem = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Гречка",
  kcal100: 313,
  protein100: 12.6,
  fat100: 3.3,
  carbs100: 57.1,
  source: "usda",
  isOwn: false,
  isRecipe: false,
};

type Search = (
  userId: string,
  query: string,
  options: { excludeRecipes: boolean },
) => Promise<FoodListItem[]>;

function deps(search = vi.fn<Search>(async () => [item])) {
  return { limiter: createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 10 }), search };
}

describe("handleFoodSearch", () => {
  it("answers 401 without a session and does not search", async () => {
    const d = deps();
    const result = await handleFoodSearch({ userId: null, rawQuery: "гр", nowMs: 0 }, d);
    expect(result).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(d.search).not.toHaveBeenCalled();
  });

  it("answers 400 for a missing or blank query", async () => {
    const d = deps();
    expect((await handleFoodSearch({ userId: "u", rawQuery: null, nowMs: 0 }, d)).status).toBe(400);
    expect((await handleFoodSearch({ userId: "u", rawQuery: "  ", nowMs: 0 }, d)).status).toBe(400);
    expect(d.search).not.toHaveBeenCalled();
  });

  it("searches with the normalized query and returns items", async () => {
    const d = deps();
    const result = await handleFoodSearch({ userId: "u", rawQuery: " ГРЁ ", nowMs: 0 }, d);
    expect(d.search).toHaveBeenCalledWith("u", "гре", { excludeRecipes: false });
    expect(result).toEqual({ status: 200, body: { items: [item] } });
  });

  it("answers 429 once the per-user limit is used up", async () => {
    const d = deps();
    await handleFoodSearch({ userId: "u", rawQuery: "a", nowMs: 0 }, d);
    await handleFoodSearch({ userId: "u", rawQuery: "a", nowMs: 0 }, d);
    const third = await handleFoodSearch({ userId: "u", rawQuery: "a", nowMs: 0 }, d);
    expect(third).toEqual({ status: 429, body: { error: "rate_limited" } });
    const other = await handleFoodSearch({ userId: "v", rawQuery: "a", nowMs: 0 }, d);
    expect(other.status).toBe(200);
  });

  it("answers 500 without details when the search throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps(vi.fn<Search>(async () => Promise.reject(new Error("db password=secret"))));
    const result = await handleFoodSearch({ userId: "u", rawQuery: "a", nowMs: 0 }, d);
    expect(result).toEqual({ status: 500, body: { error: "server_error" } });
    expect(JSON.stringify(result)).not.toContain("secret");
    error.mockRestore();
  });

  it("passes excludeRecipes only for exclude=recipes", async () => {
    const d = deps();
    await handleFoodSearch({ userId: "u", rawQuery: "гр", rawExclude: "recipes", nowMs: 0 }, d);
    await handleFoodSearch({ userId: "u", rawQuery: "гр", nowMs: 0 }, d);
    expect(d.search).toHaveBeenNthCalledWith(1, "u", "гр", { excludeRecipes: true });
    expect(d.search).toHaveBeenNthCalledWith(2, "u", "гр", { excludeRecipes: false });
  });

  it("answers 400 for an unknown exclude value", async () => {
    const d = deps();
    const result = await handleFoodSearch(
      { userId: "u", rawQuery: "гр", rawExclude: "foods", nowMs: 0 },
      d,
    );
    expect(result).toEqual({ status: 400, body: { error: "bad_query" } });
    expect(d.search).not.toHaveBeenCalled();
  });
});
