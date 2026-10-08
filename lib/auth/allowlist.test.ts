import { describe, expect, it } from "vitest";
import { isEmailAllowed, normalizeEmail, parseAllowlist } from "./allowlist";

describe("allowlist", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Me@Mail.COM ")).toBe("me@mail.com");
  });

  it("parses a comma-separated list, ignoring blanks", () => {
    expect(parseAllowlist(" A@x.io, ,b@y.io ,")).toEqual(new Set(["a@x.io", "b@y.io"]));
  });

  it("matches emails regardless of case and spaces", () => {
    expect(isEmailAllowed(" A@X.io", parseAllowlist("a@x.io"))).toBe(true);
  });

  it("allows nobody when the list is empty", () => {
    expect(isEmailAllowed("a@x.io", parseAllowlist(""))).toBe(false);
  });
});
