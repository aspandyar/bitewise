import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from "@/lib/config";
import { resolveTimeZone } from "./time-zone";

describe("resolveTimeZone", () => {
  it("uses a valid zone from the cookie", () => {
    expect(resolveTimeZone("Europe/Moscow")).toBe("Europe/Moscow");
  });

  it.each([undefined, "", "garbage", "Mars/Base"])("falls back to the default for %j", (raw) => {
    expect(resolveTimeZone(raw)).toBe(DEFAULT_TIME_ZONE);
  });

  it("falls back for an overly long value without asking Intl", () => {
    expect(resolveTimeZone("A".repeat(TIME_ZONE_COOKIE.maxLength + 1))).toBe(DEFAULT_TIME_ZONE);
  });
});
