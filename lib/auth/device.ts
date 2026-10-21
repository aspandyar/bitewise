import { createHmac, timingSafeEqual } from "node:crypto";
import { AUTH } from "@/lib/config";

type DeviceOptions = { secret: string; https: boolean; nowMs: number };
type Account = { id: string; tokenVersion: number };

const MS_PER_SECOND = 1000;

// Over https the __Host- prefix keeps a sibling or parent domain from planting the cookie.
function deviceCookieName(https: boolean): string {
  return https ? `__Host-${AUTH.deviceCookie}` : AUTH.deviceCookie;
}

// Proof that this browser signed in to the account (#30): only the server, holding the secret,
// can make it. It covers the token version, so a password change or "sign out everywhere"
// revokes every mark, and the issue time, so a mark ages out even if a browser keeps it.
function sign(account: Account, issuedMs: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`device:${account.id}:${account.tokenVersion}:${issuedMs}`)
    .digest("base64url");
}

export function deviceCookie(account: Account, { secret, https, nowMs }: DeviceOptions) {
  return {
    name: deviceCookieName(https),
    value: `${nowMs}.${sign(account, nowMs, secret)}`,
    options: {
      httpOnly: true,
      secure: https,
      path: "/",
      sameSite: "lax" as const,
      maxAge: AUTH.deviceMaxAgeSec,
    },
  };
}

// Whether the request carries a mark valid for this account now. All trusted devices of an
// account share one login bucket: marks can be minted by any signed-in session, so per-mark
// buckets would turn a stolen session into unlimited guesses at the password.
export function isTrustedDevice(
  cookieHeader: string,
  account: Account,
  options: DeviceOptions,
): boolean {
  const prefix = `${deviceCookieName(options.https)}=`;
  const value = cookieHeader
    .split(/;\s*/)
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  const [issued, mac] = value?.split(".") ?? [];
  const issuedMs = Number(issued);
  if (!mac || !Number.isSafeInteger(issuedMs)) return false;
  const ageMs = options.nowMs - issuedMs;
  if (ageMs < 0 || ageMs > AUTH.deviceMaxAgeSec * MS_PER_SECOND) return false;
  const expected = Buffer.from(sign(account, issuedMs, options.secret));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
