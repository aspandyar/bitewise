import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE } from "@/lib/config";
import { isValidTimeZone } from "@/lib/date";

// The cookie is client-controlled: anything that is not a real IANA zone gets the default.
export function resolveTimeZone(raw: string | undefined): string {
  if (!raw || raw.length > TIME_ZONE_COOKIE.maxLength) return DEFAULT_TIME_ZONE;
  return isValidTimeZone(raw) ? raw : DEFAULT_TIME_ZONE;
}
