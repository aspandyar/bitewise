import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";
import { checkToken, type AuthState } from "./token";

function deps(state: AuthState | null) {
  return { findAuthState: async () => state };
}

describe("checkToken (#29)", () => {
  const token: JWT = { sub: "u1", role: "user", ver: 2 };

  it("keeps a token whose version matches the account", async () => {
    expect(await checkToken(token, deps({ role: "user", tokenVersion: 2 }))).toEqual(token);
  });

  it("drops a token issued before a password change or sign-out everywhere", async () => {
    expect(await checkToken(token, deps({ role: "user", tokenVersion: 3 }))).toBeNull();
  });

  it("drops a token of an account that no longer exists", async () => {
    expect(await checkToken(token, deps(null))).toBeNull();
  });

  it("takes the role from the database, not from sign-in", async () => {
    expect(await checkToken(token, deps({ role: "manager", tokenVersion: 2 }))).toEqual({
      ...token,
      role: "manager",
    });
  });

  it("reads a token from before versions as version 0, so a release signs no one out", async () => {
    const old: JWT = { sub: "u1", role: "user" };
    expect(await checkToken(old, deps({ role: "user", tokenVersion: 0 }))).toEqual(old);
    expect(await checkToken(old, deps({ role: "user", tokenVersion: 1 }))).toBeNull();
  });

  it("leaves a token without a user alone", async () => {
    expect(await checkToken({}, deps(null))).toEqual({});
  });
});
