import Link from "next/link";
import { STATS_PERIODS, type StatsPeriod } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { statsHref } from "@/lib/stats/paths";

// Links, not state: the period lives in the URL, so back and reload keep it.
export function PeriodSwitch({ current }: { current: StatsPeriod }) {
  return (
    <nav className="grid grid-cols-2 gap-2">
      {STATS_PERIODS.map((period) => {
        const active = period === current;
        return (
          <Link
            key={period}
            href={statsHref(period)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg px-4 font-medium ${
              active ? "bg-accent text-on-accent" : "border border-foreground/20"
            }`}
          >
            {ru.stats.periods[period]}
          </Link>
        );
      })}
    </nav>
  );
}
