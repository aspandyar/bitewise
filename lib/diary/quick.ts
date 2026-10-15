import { z } from "zod";
import type { AmountColumns } from "@/lib/amount";
import { DIARY_LIMITS, LATE_MEAL, MEAL_BY_HOUR, QUICK, type Meal } from "@/lib/config";
import { calcPortionGrams } from "@/lib/nutrition";

export function mealForHour(hour: number): Meal {
  return MEAL_BY_HOUR.find((slot) => hour < slot.untilHour)?.meal ?? LATE_MEAL;
}

// The repeat button names a few foods and counts the rest, so it stays one line on a phone.
export function repeatSummary(names: readonly string[]): { shown: string[]; more: number } {
  return {
    shown: names.slice(0, QUICK.repeatNames),
    more: Math.max(0, names.length - QUICK.repeatNames),
  };
}

// Undo ids ride in the URL after a quick add; a day can never produce more than its entry cap.
const undoIdsSchema = z
  .string()
  .transform((value) => value.split(","))
  .pipe(z.array(z.uuid()).min(1).max(DIARY_LIMITS.maxEntriesPerDay));

export function parseUndoIds(value: string | null): string[] | null {
  const parsed = undoIdsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// A quick add repeats the last amount of the food. Grams come from the portion snapshot when
// there is one, so the new entry keeps grams = count × portion grams by construction.
export function lastAmount(entry: AmountColumns): AmountColumns {
  if (entry.portionLabel === null || entry.portionGrams === null || entry.portionCount === null) {
    return { grams: entry.grams, portionLabel: null, portionGrams: null, portionCount: null };
  }
  return {
    grams: calcPortionGrams(entry.portionGrams, entry.portionCount),
    portionLabel: entry.portionLabel,
    portionGrams: entry.portionGrams,
    portionCount: entry.portionCount,
  };
}
