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

  it("prunes expired keys even after a key restarts its window", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 });
    limiter.hit("a", 0);
    limiter.hit("b", 500);
    limiter.hit("a", 1000); // "a" starts a new window, "b" is now the oldest live entry
    expect(limiter.hit("c", 1600)).toBe(true); // "b" expired at 1500 and must be pruned
    expect(limiter.size()).toBe(2);
  });

  it("keeps rejecting new keys cheaply while full, without rescanning every entry", () => {
    const maxKeys = 100_000;
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, maxKeys });
    for (let i = 0; i < maxKeys; i++) limiter.hit(`live-${i}`, 0);
    const started = performance.now();
    for (let i = 0; i < 10_000; i++) limiter.hit(`flood-${i}`, 1);
    // A full scan per request would be 10^9 iterations (seconds); pruning from the front is ~10^4.
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("refund gives back one hit of the current window", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    expect(limiter.hit("a", 0)).toBe(true);
    limiter.refund("a", 10);
    expect(limiter.hit("a", 20)).toBe(true);
    expect(limiter.hit("a", 30)).toBe(false);
  });

  it("refund is a no-op for unknown keys and expired windows", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    limiter.refund("nobody", 0);
    expect(limiter.size()).toBe(0);
    limiter.hit("a", 0);
    limiter.refund("a", 1000);
    expect(limiter.hit("a", 1000)).toBe(true);
    expect(limiter.hit("a", 1001)).toBe(false);
  });

  it("refund leaves a window opened after the refunded hit alone", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    limiter.hit("a", 900);
    // Another request opened a fresh window while the first one was still running.
    expect(limiter.hit("a", 1950)).toBe(true);
    limiter.refund("a", 900);
    expect(limiter.hit("a", 1960)).toBe(false);
  });
});
