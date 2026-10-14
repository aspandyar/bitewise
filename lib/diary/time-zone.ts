import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from "@/lib/config";
import { isValidTimeZone } from "@/lib/date";

const OFFSET = /^[+-]/;

// The cookie is client-controlled: anything that is not a real IANA zone gets the default.
// Intl also accepts raw offsets up to ±23:59, which would let "today" run almost two days ahead;
// browsers always report IANA names, so offsets only come from a hand-edited cookie.
export function resolveTimeZone(raw: string | undefined): string {
  if (!raw || raw.length > TIME_ZONE_COOKIE.maxLength || OFFSET.test(raw)) {
    return DEFAULT_TIME_ZONE;
  }
  return isValidTimeZone(raw) ? raw : DEFAULT_TIME_ZONE;
}

// Some browsers report no zone at all; writing "tz=undefined" would never match the next read
// and refresh the page on every visit, so the server default is left in place instead.
// IANA names hold only letters, digits, "_", "+", "-" and "/", all valid in a cookie value.
export function timeZoneCookieToSet(
  zone: string | undefined,
  documentCookie: string,
  { https }: { https: boolean },
): string | null {
  if (!zone || zone.length > TIME_ZONE_COOKIE.maxLength) return null;
  const prefix = `${TIME_ZONE_COOKIE.name}=`;
  const current = documentCookie
    .split("; ")
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  if (current === zone) return null;
  const secure = https ? "; secure" : "";
  return `${prefix}${zone}; path=/; max-age=${TIME_ZONE_COOKIE.maxAgeSec}; samesite=lax${secure}`;
}
