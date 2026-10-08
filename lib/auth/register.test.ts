import { describe, expect, it, vi } from "vitest";
import { ru } from "@/lib/i18n/ru";
import { createRateLimiter } from "./rate-limit";
import { registerUser, type RegisterDeps } from "./register";
import { UNKNOWN_IP } from "./request";

function makeDeps(overrides: Partial<RegisterDeps> = {}): RegisterDeps {
  return {
    limiter: createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 }),
    nowMs: 0,
    hashPassword: async (password) => `hashed:${password}`,
    createUser: async () => ({ id: "u1" }),
    ...overrides,
  };
}

const valid = { email: "  ME@mail.com ", password: "12345678" };

describe("registerUser", () => {
  it("creates a user with a normalized email and hashed password", async () => {
    const createUser = vi.fn(async () => ({ id: "u1" }));
    expect(await registerUser(valid, "1.1.1.1", makeDeps({ createUser }))).toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledWith("me@mail.com", "hashed:12345678");
  });

  it("is open to any valid email", async () => {
    const result = await registerUser(
      { email: "anyone@example.org", password: "12345678" },
      "1.1.1.1",
      makeDeps(),
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns field errors for invalid input", async () => {
    const result = await registerUser({ email: "bad", password: "1" }, "1.1.1.1", makeDeps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["email", "password"]);
  });

  it("answers a taken email with a generic message", async () => {
    const result = await registerUser(valid, "1.1.1.1", makeDeps({ createUser: async () => null }));
    expect(result).toEqual({ ok: false, formError: ru.auth.registerFailed });
  });

  it("hashes the password even when the email is taken, so timing does not reveal accounts", async () => {
    const hashPassword = vi.fn(async (password: string) => `hashed:${password}`);
    await registerUser(valid, "1.1.1.1", makeDeps({ hashPassword, createUser: async () => null }));
    expect(hashPassword).toHaveBeenCalledTimes(1);
  });

  it("stops after the rate limit is exhausted", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    await registerUser(valid, "1.1.1.1", deps);
    expect(await registerUser(valid, "1.1.1.1", deps)).toEqual({
      ok: false,
      formError: ru.auth.tooManyAttempts,
    });
  });

  it("does not share one bucket among clients whose IP is unknown", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    await registerUser(valid, UNKNOWN_IP, deps);
    expect(await registerUser(valid, UNKNOWN_IP, deps)).toEqual({ ok: true });
  });
});
