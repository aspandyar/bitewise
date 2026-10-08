import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max hits per key inside the window", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 10)).toBe(true);
    expect(limiter.hit("a", 20)).toBe(false);
  });

  it("counts keys independently", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("b", 0)).toBe(true);
    expect(limiter.hit("a", 1)).toBe(false);
  });

  it("starts a new window once the old one expires", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 999)).toBe(false);
    expect(limiter.hit("a", 1000)).toBe(true);
  });

  it("drops expired keys when the key limit is reached", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 });
    limiter.hit("a", 0);
    limiter.hit("b", 0);
    limiter.hit("c", 5000);
    expect(limiter.size()).toBe(1);
  });

  it("refuses new keys instead of evicting live counters when full", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 });
    expect(limiter.hit("victim", 0)).toBe(true);
    limiter.hit("flood-1", 1);
    // Evicting "victim" here would hand an attacker a fresh set of attempts.
    expect(limiter.hit("flood-2", 2)).toBe(false);
    expect(limiter.size()).toBe(2);
    expect(limiter.hit("victim", 3)).toBe(false);
  });
});
