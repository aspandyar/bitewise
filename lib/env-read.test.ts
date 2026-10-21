import { describe, expect, it } from "vitest";
import { isRegistrationOpen, readAuthEnv } from "./env-read";

const secret = "x".repeat(32);

describe("readAuthEnv", () => {
  it("rejects a plain-http NEXTAUTH_URL in production, where the session cookie would lose Secure", () => {
    expect(() =>
      readAuthEnv({
        NODE_ENV: "production",
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: "http://bitewise.example",
      }),
    ).toThrow();
  });

  it("accepts https in production", () => {
    expect(
      readAuthEnv({
        NODE_ENV: "production",
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: "https://bitewise.example",
      }).NEXTAUTH_URL,
    ).toBe("https://bitewise.example");
  });

  it("allows http://localhost in development", () => {
    expect(
      readAuthEnv({
        NODE_ENV: "development",
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: "http://localhost:3000",
      }).NEXTAUTH_URL,
    ).toBe("http://localhost:3000");
  });

  it("allows http://localhost in production, so a local production build still works", () => {
    expect(
      readAuthEnv({
        NODE_ENV: "production",
        NEXTAUTH_SECRET: secret,
        NEXTAUTH_URL: "http://localhost:3000",
      }).NEXTAUTH_URL,
    ).toBe("http://localhost:3000");
  });
});

describe("isRegistrationOpen", () => {
  it("is closed unless REGISTRATION=open says otherwise (#27)", () => {
    expect(isRegistrationOpen({})).toBe(false);
    expect(isRegistrationOpen({ REGISTRATION: "closed" })).toBe(false);
    expect(isRegistrationOpen({ REGISTRATION: "open" })).toBe(true);
  });

  it("fails fast on a value it does not know", () => {
    expect(() => isRegistrationOpen({ REGISTRATION: "yes" })).toThrow();
  });
});
