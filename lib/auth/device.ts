import { createHmac, timingSafeEqual } from "node:crypto";
import { AUTH } from "@/lib/config";

type DeviceOptions = { secret: string; https: boolean };

// Over https the __Host- prefix keeps a sibling or parent domain from planting the cookie.
function deviceCookieName(https: boolean): string {
  return https ? `__Host-${AUTH.deviceCookie}` : AUTH.deviceCookie;
}

// Proof that this browser once signed in to the account: only the server, holding the secret,
// can make it, so an attacker guessing passwords elsewhere never has it (#30).
function deviceToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`device:${userId}`).digest("base64url");
}

export function deviceCookie(userId: string, { secret, https }: DeviceOptions) {
  return {
    name: deviceCookieName(https),
    value: deviceToken(userId, secret),
    options: {
      httpOnly: true,
      secure: https,
      path: "/",
      sameSite: "lax" as const,
      maxAge: AUTH.deviceMaxAgeSec,
    },
  };
}

export function isTrustedDevice(cookieHeader: string, userId: string, options: DeviceOptions): boolean {
  const prefix = `${deviceCookieName(options.https)}=`;
  const value = cookieHeader
    .split(/;\s*/)
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) return false;
  const expected = Buffer.from(deviceToken(userId, options.secret));
  const given = Buffer.from(value);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
