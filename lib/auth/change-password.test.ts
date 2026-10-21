import { describe, expect, it, vi } from "vitest";
import { ru } from "@/lib/i18n/ru";
import { changePassword, type ChangePasswordDeps } from "./change-password";
import { createRateLimiter } from "./rate-limit";
import { BusyError } from "./semaphore";

function makeDeps(overrides: Partial<ChangePasswordDeps> = {}): ChangePasswordDeps {
  return {
    limiter: createRateLimiter({ max: 100, windowMs: 1000, maxKeys: 100 }),
    nowMs: 0,
    findPasswordHash: async () => ({ email: "me@mail.com", passwordHash: "stored", role: "user" }),
    verifyPassword: async (password, stored) => stored === "stored" && password === "old-pass-1",
    hashPassword: async (password) => `hashed:${password}`,
    updatePasswordHash: async () => undefined,
    ...overrides,
  };
}

const valid = { currentPassword: "old-pass-1", newPassword: "new-pass-2" };
const account = { id: "u1", tokenVersion: 0 };

describe("changePassword (#29)", () => {
  it("stores the new hash and answers with the email to sign in again with", async () => {
    const updatePasswordHash = vi.fn(async () => undefined);
    expect(await changePassword(valid, account, makeDeps({ updatePasswordHash }))).toEqual({
      ok: true,
      email: "me@mail.com",
    });
    expect(updatePasswordHash).toHaveBeenCalledWith("u1", "hashed:new-pass-2");
  });

  it("refuses a wrong current password at its field and changes nothing", async () => {
    const updatePasswordHash = vi.fn(async () => undefined);
    const result = await changePassword(
      { ...valid, currentPassword: "guess" },
      account,
      makeDeps({ updatePasswordHash }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: { currentPassword: ru.auth.wrongCurrentPassword },
    });
    expect(updatePasswordHash).not.toHaveBeenCalled();
  });

  it("checks the new password like sign-up does", async () => {
    const result = await changePassword({ ...valid, newPassword: "short" }, account, makeDeps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["newPassword"]);
  });

  it("refuses a new password equal to the current one", async () => {
    const result = await changePassword(
      { currentPassword: "old-pass-1", newPassword: "old-pass-1" },
      account,
      makeDeps(),
    );
    expect(result).toEqual({ ok: false, fieldErrors: { newPassword: ru.auth.samePassword } });
  });

  it("limits guesses of the current password per account", async () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 100 });
    const guess = { ...valid, currentPassword: "guess" };
    await changePassword(guess, account, makeDeps({ limiter }));
    await changePassword(guess, account, makeDeps({ limiter }));
    expect(await changePassword(valid, account, makeDeps({ limiter }))).toEqual({
      ok: false,
      formError: ru.auth.tooManyAttempts,
    });
  });

  it("gives a fresh budget after sign-out everywhere, so a thief cannot keep the owner out", async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 100 });
    await changePassword({ ...valid, currentPassword: "guess" }, account, makeDeps({ limiter }));
    const afterSignOut = { id: "u1", tokenVersion: 1 };
    expect(await changePassword(valid, afterSignOut, makeDeps({ limiter }))).toMatchObject({
      ok: true,
    });
  });

  it("refuses the admin: its password comes from ADMIN_PASSWORD, which bootstrap restores", async () => {
    const updatePasswordHash = vi.fn(async () => undefined);
    const findPasswordHash = async () => ({
      email: "admin@bitewise.invalid",
      passwordHash: "stored",
      role: "admin" as const,
    });
    expect(
      await changePassword(valid, account, makeDeps({ findPasswordHash, updatePasswordHash })),
    ).toEqual({ ok: false, formError: ru.auth.adminPasswordFromEnv });
    expect(updatePasswordHash).not.toHaveBeenCalled();
  });

  it("answers 'too many attempts' when the hashing queue is full", async () => {
    const verifyPassword = async () => {
      throw new BusyError();
    };
    expect(await changePassword(valid, account, makeDeps({ verifyPassword }))).toEqual({
      ok: false,
      formError: ru.auth.tooManyAttempts,
    });
  });
});
