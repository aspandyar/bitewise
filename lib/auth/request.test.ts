import { describe, expect, it } from "vitest";
import { clientIpFromForwardedFor } from "./request";

describe("clientIpFromForwardedFor", () => {
  it("takes the first address of the chain", () => {
    expect(clientIpFromForwardedFor("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
  });

  it.each([null, undefined, "", "  "])("falls back to 'unknown' for %j", (value) => {
    expect(clientIpFromForwardedFor(value)).toBe("unknown");
  });
});
