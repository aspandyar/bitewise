import { describe, expect, it } from "vitest";
import { readAuthEnv } from "./env";

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

