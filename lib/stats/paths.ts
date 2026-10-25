import type { StatsPeriod } from "@/lib/config";

export const STATS_HREF = "/stats";

export function statsHref(period: StatsPeriod): string {
  return `${STATS_HREF}?period=${period}`;
}
