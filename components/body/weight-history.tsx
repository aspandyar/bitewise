import Link from "next/link";
import type { WeightEntry } from "@/lib/body";
import type { IsoDate } from "@/lib/date";
import { formatDayLabel, formatWeightKg } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { weightHref } from "@/lib/weight/paths";

// Newest first; a row opens the weigh-in to fix or delete it.
export function WeightHistory({
  entries,
  today,
}: {
  entries: readonly WeightEntry[];
  today: IsoDate;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{ru.body.history}</h2>
      <ul className="-mx-2 flex flex-col divide-y divide-foreground/10">
        {entries.map((entry) => (
          <li key={entry.date}>
            <Link
              href={weightHref(entry.date)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2"
            >
              <span>{formatDayLabel(entry.date, today)}</span>
              <span className="font-medium">{ru.body.kg(formatWeightKg(entry.weightKg))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
