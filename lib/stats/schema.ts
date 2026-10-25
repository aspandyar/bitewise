import { z } from "zod";
import { STATS, STATS_PERIODS, type StatsPeriod } from "@/lib/config";

const periodSchema = z.enum(STATS_PERIODS);

// From the URL: anything unknown falls back to the default instead of a 404.
export function parsePeriod(value: unknown): StatsPeriod {
  const parsed = periodSchema.safeParse(value);
  return parsed.success ? parsed.data : STATS.defaultPeriod;
}
