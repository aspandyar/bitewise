import { describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/lib/config";
import { bootstrapAdmin, BootstrapError, type BootstrapDeps } from "./bootstrap-admin";

type StoredUser = { id: string; role: UserRole; passwordHash: string };

function makeDeps(existing: StoredUser | null, overrides: Partial<BootstrapDeps> = {}) {
  const deps: BootstrapDeps = {
    findUser: async () => existing,
    createAdmin: vi.fn(async () => {}),
    updatePasswordHash: vi.fn(async () => {}),
    hashPassword: async (password) => `hashed:${password}`,
    verifyPassword: async (password, stored) => stored === `hashed:${password}`,
    ...overrides,
  };
  return deps;
}

const input = { email: " Admin@Bitewise.invalid ", password: "admin-pass-1234" };

describe("bootstrapAdmin", () => {
  it("creates the admin when the email is free, with a normalized email and hashed password", async () => {
    const deps = makeDeps(null);
    expect(await bootstrapAdmin(input, deps)).toBe("created");
    expect(deps.createAdmin).toHaveBeenCalledWith(
      "admin@bitewise.invalid",
      "hashed:admin-pass-1234",
    );
  });

  it("does nothing when the admin exists and the password still matches", async () => {
    const deps = makeDeps({ id: "a1", role: "admin", passwordHash: "hashed:admin-pass-1234" });
    expect(await bootstrapAdmin(input, deps)).toBe("unchanged");
    expect(deps.updatePasswordHash).not.toHaveBeenCalled();
  });

  it("rehashes when the password in env changed", async () => {
    const deps = makeDeps({ id: "a1", role: "admin", passwordHash: "hashed:old-password" });
    expect(await bootstrapAdmin(input, deps)).toBe("password_updated");
    expect(deps.updatePasswordHash).toHaveBeenCalledWith("a1", "hashed:admin-pass-1234");
  });

  it("refuses to promote an account someone registered with the admin email", async () => {
    const deps = makeDeps({ id: "u1", role: "user", passwordHash: "hashed:attacker" });
    await expect(bootstrapAdmin(input, deps)).rejects.toThrow(BootstrapError);
    expect(deps.updatePasswordHash).not.toHaveBeenCalled();
    expect(deps.createAdmin).not.toHaveBeenCalled();
  });

  it.each([
    { email: "not-an-email", password: "admin-pass-1234" },
    { email: "admin@bitewise.invalid", password: "short" },
    { email: undefined, password: undefined },
  ])("rejects invalid env values %j", async (bad) => {
    await expect(bootstrapAdmin(bad, makeDeps(null))).rejects.toThrow(BootstrapError);
  });
});
