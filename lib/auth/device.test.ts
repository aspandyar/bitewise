import { describe, expect, it } from "vitest";
import { AUTH } from "@/lib/config";
import { deviceCookie, trustedDeviceId } from "./device";

const secret = "s".repeat(32);
const user = { id: "u1", tokenVersion: 0 };
const options = { secret, https: true, nowMs: 1_000_000 };

function cookieHeader(account = user, issuedMs = options.nowMs, https = true) {
  const { name, value } = deviceCookie(account, { secret, https, nowMs: issuedMs });
  return `tz=Asia/Almaty; ${name}=${value}`;
}

describe("device mark (#30)", () => {
  it("recognises the device a user signed in from and names its own bucket", () => {
    const id = trustedDeviceId(cookieHeader(), user, options);
    expect(id).toEqual(expect.any(String));
    const other = trustedDeviceId(cookieHeader(user, options.nowMs - 1000), user, options);
    expect(other).not.toBe(id);
  });

  it("does not vouch for another account, a forged value, another secret or no cookie", () => {
    expect(trustedDeviceId(cookieHeader(), { id: "u2", tokenVersion: 0 }, options)).toBeNull();
    const { name } = deviceCookie(user, options);
    expect(trustedDeviceId(`${name}=1000.${"A".repeat(43)}`, user, options)).toBeNull();
    expect(trustedDeviceId(`${name}=short`, user, options)).toBeNull();
    expect(trustedDeviceId(cookieHeader(), user, { ...options, secret: "t".repeat(32) })).toBeNull();
    expect(trustedDeviceId("", user, options)).toBeNull();
  });

  it("stops counting after a password change or sign-out everywhere", () => {
    expect(trustedDeviceId(cookieHeader(), { id: "u1", tokenVersion: 1 }, options)).toBeNull();
  });

  it("expires with its cookie, even if the browser keeps sending it", () => {
    const old = cookieHeader(user, options.nowMs);
    const later = { ...options, nowMs: options.nowMs + AUTH.deviceMaxAgeSec * 1000 + 1 };
    expect(trustedDeviceId(old, user, later)).toBeNull();
  });

  it("is an httpOnly __Host- cookie over https and a plain one over http", () => {
    expect(deviceCookie(user, options)).toMatchObject({
      name: expect.stringMatching(/^__Host-/),
      options: {
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "lax",
        maxAge: AUTH.deviceMaxAgeSec,
      },
    });
    const plain = deviceCookie(user, { ...options, https: false });
    expect(plain.name).not.toMatch(/^__Host-/);
    expect(plain.options.secure).toBe(false);
    expect(
      trustedDeviceId(cookieHeader(user, options.nowMs, false), user, { ...options, https: false }),
    ).not.toBeNull();
  });
});
