import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { handleBarcodeLookup } from "./barcode-lookup";
import type { FoodValues } from "./types";

const CODE = "4610169567113";
const NOW = 1_000_000;
const bar: FoodValues = {
  name: "Батончик (Bombbar)",
  kcal100: 288.33,
  protein100: 33.33,
  fat100: 7.17,
  carbs100: 5.83,
  fiber100: 33.33,
};
const offFound = {
  kind: "found" as const,
  values: bar,
  portionGrams: 60,
  sourceUrl: `https://world.openfoodfacts.org/product/${CODE}`,
};

type Deps = Parameters<typeof handleBarcodeLookup>[1];

function setup(limiters: Partial<Pick<Deps, "userLimiter" | "offLimiter">> = {}) {
  const deps = {
    userLimiter: createRateLimiter({ max: 10, windowMs: 60_000, maxKeys: 100 }),
    offLimiter: createRateLimiter({ max: 10, windowMs: 60_000, maxKeys: 1 }),
    find: vi.fn<Deps["find"]>().mockResolvedValue(null),
    fetchOff: vi.fn<Deps["fetchOff"]>().mockResolvedValue(offFound),
    saveOff: vi.fn<Deps["saveOff"]>().mockResolvedValue({ id: "off-food" }),
    ...limiters,
  };
  const lookup = (rawCode: string | null, userId: string | null = "alice") =>
    handleBarcodeLookup({ userId, rawCode, nowMs: NOW }, deps);
  return { deps, lookup };
}

afterEach(() => vi.restoreAllMocks());

describe("handleBarcodeLookup", () => {
  it("refuses a request without a session", async () => {
    const { lookup, deps } = setup();
    expect(await lookup(CODE, null)).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(deps.find).not.toHaveBeenCalled();
  });

  it("rejects a bad code before touching the database or Open Food Facts", async () => {
    const { lookup, deps } = setup();
    for (const raw of [null, "", "abc", "4610169567114"]) {
      expect(await lookup(raw)).toEqual({ status: 400, body: { error: "bad_code" } });
    }
    expect(deps.find).not.toHaveBeenCalled();
    expect(deps.fetchOff).not.toHaveBeenCalled();
  });

  it("answers from our database without asking Open Food Facts", async () => {
    const { lookup, deps } = setup();
    deps.find.mockResolvedValue({ id: "own-food", isOwn: true });
    expect(await lookup(` ${CODE} `)).toEqual({
      status: 200,
      body: { status: "found", foodId: "own-food" },
    });
    expect(deps.find).toHaveBeenCalledWith("alice", CODE);
    expect(deps.fetchOff).not.toHaveBeenCalled();
  });

  it("looks a UPC-A up by its EAN-13 form", async () => {
    const { lookup, deps } = setup();
    deps.find.mockResolvedValue({ id: "food", isOwn: false });
    await lookup("036000291452");
    expect(deps.find).toHaveBeenCalledWith("alice", "0036000291452");
  });

  it("saves a product found in Open Food Facts as shared and returns it", async () => {
    const { lookup, deps } = setup();
    expect(await lookup(CODE)).toEqual({
      status: 200,
      body: { status: "found", foodId: "off-food" },
    });
    expect(deps.fetchOff).toHaveBeenCalledWith(CODE);
    expect(deps.saveOff).toHaveBeenCalledWith(CODE, {
      values: bar,
      portionGrams: 60,
      sourceUrl: offFound.sourceUrl,
    });
  });

  it("turns incomplete data into not found with the known hints", async () => {
    const { lookup, deps } = setup();
    deps.fetchOff.mockResolvedValue({
      kind: "incomplete",
      hints: { name: "Батончик", kcal100: 288 },
    });
    expect(await lookup(CODE)).toEqual({
      status: 200,
      body: { status: "not_found", code: CODE, hints: { name: "Батончик", kcal100: 288 } },
    });
    expect(deps.saveOff).not.toHaveBeenCalled();
  });

  it("reports an unknown code as not found with no hints", async () => {
    const { lookup, deps } = setup();
    deps.fetchOff.mockResolvedValue({ kind: "not_found" });
    expect(await lookup(CODE)).toEqual({
      status: 200,
      body: { status: "not_found", code: CODE, hints: {} },
    });
  });

  it("reports Open Food Facts being down as unavailable", async () => {
    const { lookup, deps } = setup();
    deps.fetchOff.mockResolvedValue({ kind: "unavailable" });
    expect(await lookup(CODE)).toEqual({
      status: 200,
      body: { status: "unavailable", code: CODE },
    });
  });

  it("reports unavailable without calling out once the shared outbound budget is spent", async () => {
    const offLimiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 1 });
    const { lookup, deps } = setup({ offLimiter });
    deps.fetchOff.mockResolvedValue({ kind: "not_found" });
    await lookup(CODE, "alice");
    expect(await lookup(CODE, "bob")).toEqual({
      status: 200,
      body: { status: "unavailable", code: CODE },
    });
    expect(deps.fetchOff).toHaveBeenCalledTimes(1);
    expect(deps.find).toHaveBeenCalledTimes(2);
  });

  it("limits lookups per user", async () => {
    const userLimiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 100 });
    const { lookup } = setup({ userLimiter });
    await lookup(CODE);
    expect(await lookup(CODE)).toEqual({ status: 429, body: { error: "rate_limited" } });
    expect((await lookup(CODE, "bob")).status).toBe(200);
  });

  it("answers 500 without details and logs neither the code nor the product", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { lookup, deps } = setup();
    deps.saveOff.mockRejectedValue(new Error("insert failed"));
    expect(await lookup(CODE)).toEqual({ status: 500, body: { error: "server_error" } });
    deps.find.mockRejectedValue(new Error("connection refused"));
    expect(await lookup(CODE)).toEqual({ status: 500, body: { error: "server_error" } });

    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain(bar.name);
    expect(logged).toContain("barcode lookup failed");
  });
});
