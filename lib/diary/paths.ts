import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import type { AddError } from "./quick";

// Today lives at "/" so the installed app always opens on the current day.
export function dayHref(date: IsoDate, today: IsoDate): string {
  return date === today ? "/" : `/?date=${date}`;
}

export function diarySearch(date: IsoDate, meal: Meal): string {
  return new URLSearchParams({ date, meal }).toString();
}

export function addHref(date: IsoDate, meal: Meal, error?: AddError): string {
  const href = `/diary/add?${diarySearch(date, meal)}`;
  return error ? `${href}&error=${error}` : href;
}

export const QUICK_KCAL_PATH = "/diary/quick";

export function quickKcalHref(date: IsoDate, meal: Meal): string {
  return `${QUICK_KCAL_PATH}?${diarySearch(date, meal)}`;
}

export function editHref(entryId: string): string {
  return `/diary/entries/${entryId}/edit`;
}

// "from" names the dish the amount screen was opened from, so Back returns there.
export function addFoodHref(
  foodId: string,
  date: IsoDate,
  meal: Meal,
  from?: { recipeId: string },
): string {
  const href = `/diary/add/${foodId}?${diarySearch(date, meal)}`;
  return from ? `${href}&from=${from.recipeId}` : href;
}
