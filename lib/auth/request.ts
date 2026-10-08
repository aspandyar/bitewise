import { TRUSTED_PROXY_HOPS } from "@/lib/config";

// Callers must not rate-limit by this value: every client without a header would share one bucket.
export const UNKNOWN_IP = "unknown";

// Only entries appended by our own proxies are trustworthy; anything to their left is whatever the
// client chose to send, so reading the leftmost entry would let anyone dodge per-IP limits.
export function clientIpFromForwardedFor(
  value: string | null | undefined,
  trustedHops: number = TRUSTED_PROXY_HOPS,
): string {
  const chain = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return chain[chain.length - trustedHops] ?? UNKNOWN_IP;
}

// Repeated X-Forwarded-For headers can arrive as an array; dropping them would turn the client
// into UNKNOWN_IP and skip the per-IP limit, so they are joined in order instead.
export function forwardedForHeader(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) {
    return value.join(", ");
  }
  return null;
}
