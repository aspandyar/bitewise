import Link from "next/link";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { addHref, editHref } from "@/lib/diary/paths";
import type { DiaryEntry } from "@/lib/diary/types";
import { formatEntryAmount, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import type { Nutrients } from "@/lib/nutrition";

// Nutrients are computed on the server page; this component only lays them out.
export type EntryRow = DiaryEntry & { nutrients: Nutrients };

export function MealSection({
  meal,
  date,
  rows,
  kcal,
}: {
  meal: Meal;
  date: IsoDate;
  rows: EntryRow[];
  kcal: number;
}) {
  const title = ru.diary.meals[meal];
  const headingId = `meal-${meal}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-medium">
          {title}
        </h2>
        {rows.length > 0 ? (
          <span className="text-sm text-foreground/60">
            {formatKcal(kcal)} {ru.targets.kcalUnit}
          </span>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={editHref(row.id)}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="[overflow-wrap:anywhere]">{row.foodName}</span>
                  <span className="text-sm text-foreground/60">{formatEntryAmount(row)}</span>
                </span>
                <span className="shrink-0 text-sm">
                  {formatKcal(row.nutrients.kcal)} {ru.targets.kcalUnit}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={addHref(date, meal)}
        aria-label={ru.diary.addTo(title)}
        className="flex min-h-11 w-fit items-center text-sm underline"
      >
        {ru.diary.add}
      </Link>
    </section>
  );
}
