import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";

// Today lives at "/" so the installed app always opens on the current day.
export function dayHref(date: IsoDate, today: IsoDate): string {
  return date === today ? "/" : `/?date=${date}`;
}

export function diarySearch(date: IsoDate, meal: Meal): string {
  return new URLSearchParams({ date, meal }).toString();
}

export function addHref(date: IsoDate, meal: Meal): string {
  return `/diary/add?${diarySearch(date, meal)}`;
}

export function editHref(entryId: string): string {
  return `/diary/entries/${entryId}/edit`;
}
