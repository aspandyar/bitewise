import { WEIGHT } from "@/lib/config";
import { addDays, type IsoDate } from "@/lib/date";

export type WeightEntry = { date: IsoDate; weightKg: number };
export type WeightPoint = WeightEntry & { averageKg: number };

// The average covers calendar days, not the last N weigh-ins: after a week off the scale, the
// line restarts from the new reading instead of dragging the old ones along.
export function calcWeightTrend(entries: readonly WeightEntry[]): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((entry) => {
    const from = addDays(entry.date, 1 - WEIGHT.averageDays);
    // ISO dates compare correctly as plain strings.
    const window = sorted.filter((other) => other.date >= from && other.date <= entry.date);
    const averageKg = window.reduce((sum, other) => sum + other.weightKg, 0) / window.length;
    return { ...entry, averageKg };
  });
}
