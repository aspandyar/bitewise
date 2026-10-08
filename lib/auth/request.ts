const UNKNOWN_IP = "unknown";

// nginx (stage 6) must overwrite X-Forwarded-For, otherwise clients can spoof it to dodge limits.
export function clientIpFromForwardedFor(value: string | null | undefined): string {
  const first = value?.split(",")[0]?.trim();
  return first ? first : UNKNOWN_IP;
}
