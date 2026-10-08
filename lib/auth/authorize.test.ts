import { describe, expect, it, vi } from "vitest";
import { authorizeCredentials, type AuthorizeDeps } from "./authorize";
import { createRateLimiter } from "./rate-limit";
import { UNKNOWN_IP } from "./request";

function makeDeps(overrides: Partial<AuthorizeDeps> = {}): AuthorizeDeps {
  return {
    findUserByEmail: async (email) =>
      email === "me@mail.com" ? { id: "u1", passwordHash: "stored" } : null,
    verifyPassword: async (password, stored) => stored === "stored" && password === "right-pass",
    getDummyPasswordHash: async () => "dummy",
    limiter: createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 }),
    nowMs: 0,
    ...overrides,
  };
}

const right = { email: "me@mail.com", password: "right-pass" };

describe("authorizeCredentials", () => {
  it("returns the user for correct credentials, normalizing the email", async () => {
    const user = await authorizeCredentials(
      { email: " Me@Mail.com", password: "right-pass" },
      "1.1.1.1",
      makeDeps(),
    );
    expect(user).toEqual({ id: "u1", email: "me@mail.com" });
  });

  it("returns null for a wrong password", async () => {
    const user = await authorizeCredentials(
      { email: "me@mail.com", password: "wrong-pass" },
      "1.1.1.1",
      makeDeps(),
    );
    expect(user).toBeNull();
  });

  it("still runs a password check for unknown emails to keep timing uniform", async () => {
    const verifyPassword = vi.fn(async () => false);
    const user = await authorizeCredentials(
      { email: "nobody@mail.com", password: "right-pass" },
      "1.1.1.1",
      makeDeps({ verifyPassword }),
    );
    expect(user).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("right-pass", "dummy");
  });

  it("returns null for malformed input without touching the database", async () => {
    const findUserByEmail = vi.fn();
    expect(
      await authorizeCredentials({ email: "x" }, "1.1.1.1", makeDeps({ findUserByEmail })),
    ).toBeNull();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("refuses correct credentials once the per-IP limit is exhausted", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    expect(await authorizeCredentials(right, "1.1.1.1", deps)).not.toBeNull();
    expect(await authorizeCredentials(right, "1.1.1.1", deps)).toBeNull();
  });

  it("refuses correct credentials once the per-account limit is exhausted from many IPs", async () => {
    const deps = makeDeps({ limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }) });
    expect(await authorizeCredentials(right, "1.1.1.1", deps)).not.toBeNull();
    expect(await authorizeCredentials(right, "2.2.2.2", deps)).toBeNull();
  });

  it("still runs a password check when the account is rate-limited, so timing does not reveal it", async () => {
    const verifyPassword = vi.fn(async () => true);
    const deps = makeDeps({
      verifyPassword,
      limiter: createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 }),
    });
    await authorizeCredentials(right, "1.1.1.1", deps);
    expect(await authorizeCredentials(right, "2.2.2.2", deps)).toBeNull();
    expect(verifyPassword).toHaveBeenCalledTimes(2);
  });

  it("creates no counter for unknown emails, so junk emails cannot fill the limiter", async () => {
    const limiter = createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 });
    await authorizeCredentials(
      { email: "junk@mail.com", password: "whatever1" },
      "1.1.1.1",
      makeDeps({ limiter }),
    );
    expect(limiter.size()).toBe(1); // only the IP key
  });

  it("does not share one bucket among clients whose IP is unknown", async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    const deps = makeDeps({ limiter });
    await authorizeCredentials({ email: "junk@mail.com", password: "whatever1" }, UNKNOWN_IP, deps);
    expect(await authorizeCredentials(right, UNKNOWN_IP, deps)).not.toBeNull();
  });

  it("returns null instead of throwing when the database fails, so its error never reaches the client", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await authorizeCredentials(
      right,
      "1.1.1.1",
      makeDeps({
        findUserByEmail: async () => {
          throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
        },
      }),
    );
    expect(user).toBeNull();
    consoleError.mockRestore();
  });
});
