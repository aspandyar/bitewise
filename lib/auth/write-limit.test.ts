import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/lib/config";
import { createRateLimiter } from "./rate-limit";
import { allowWrite } from "./write-limit";

describe("allowWrite", () => {
  it("lets a user write up to the per-minute cap, then refuses until the window passes", () => {
    const limiter = createRateLimiter(RATE_LIMITS.write);
    for (let i = 0; i < RATE_LIMITS.write.max; i += 1) {
      expect(allowWrite("alice", 0, limiter)).toBe(true);
    }
    expect(allowWrite("alice", 0, limiter)).toBe(false);
    expect(allowWrite("alice", RATE_LIMITS.write.windowMs, limiter)).toBe(true);
  });

  it("counts each user separately", () => {
    const limiter = createRateLimiter(RATE_LIMITS.write);
    for (let i = 0; i < RATE_LIMITS.write.max; i += 1) allowWrite("alice", 0, limiter);
    expect(allowWrite("bob", 0, limiter)).toBe(true);
  });
});
