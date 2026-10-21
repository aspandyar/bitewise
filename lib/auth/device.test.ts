import { describe, expect, it } from "vitest";
import { AUTH } from "@/lib/config";
import { deviceCookie, isTrustedDevice } from "./device";

const secret = "s".repeat(32);

function cookieHeader(userId: string, https = true) {
  const { name, value } = deviceCookie(userId, { secret, https });
  return `tz=Asia/Almaty; ${name}=${value}`;
}

describe("device mark (#30)", () => {
  it("recognises the device a user signed in from", () => {
    expect(isTrustedDevice(cookieHeader("u1"), "u1", { secret, https: true })).toBe(true);
  });

  it("does not vouch for another account, a forged value, another secret or no cookie", () => {
    expect(isTrustedDevice(cookieHeader("u1"), "u2", { secret, https: true })).toBe(false);
    const { name } = deviceCookie("u1", { secret, https: true });
    expect(isTrustedDevice(`${name}=${"A".repeat(43)}`, "u1", { secret, https: true })).toBe(false);
    expect(isTrustedDevice(`${name}=short`, "u1", { secret, https: true })).toBe(false);
    expect(
      isTrustedDevice(cookieHeader("u1"), "u1", { secret: "t".repeat(32), https: true }),
    ).toBe(false);
    expect(isTrustedDevice("", "u1", { secret, https: true })).toBe(false);
  });

  it("is an httpOnly __Host- cookie over https and a plain one over http", () => {
    expect(deviceCookie("u1", { secret, https: true })).toMatchObject({
      name: expect.stringMatching(/^__Host-/),
      options: {
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "lax",
        maxAge: AUTH.deviceMaxAgeSec,
      },
    });
    const plain = deviceCookie("u1", { secret, https: false });
    expect(plain.name).not.toMatch(/^__Host-/);
    expect(plain.options.secure).toBe(false);
    expect(isTrustedDevice(cookieHeader("u1", false), "u1", { secret, https: false })).toBe(true);
  });
});
