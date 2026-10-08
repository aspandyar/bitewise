import { describe, expect, it } from "vitest";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("never stores the plain password and salts every hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toContain("same password");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
  });

  it.each([
    "",
    "plain",
    "scrypt$1$2$3",
    "bcrypt$32768$8$3$c2FsdA==$aGFzaA==",
    "scrypt$abc$8$3$c2FsdA==$aGFzaA==",
  ])("returns false for malformed stored hash %j", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });

  it("provides a dummy hash that no password matches", async () => {
    const dummy = await getDummyPasswordHash();
    expect(await verifyPassword("", dummy)).toBe(false);
  });
});
