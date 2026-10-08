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
