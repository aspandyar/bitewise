import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { KcalChart } from "@/components/stats/kcal-chart";
import { PeriodSwitch } from "@/components/stats/period-switch";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { STATS } from "@/lib/config";
import { addDays } from "@/lib/date";
import { dayHref } from "@/lib/diary/paths";
import { getUserToday } from "@/lib/diary/today";
import { formatDayLabel, formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { calcDayTotals, calcPeriodSummary } from "@/lib/nutrition";
import { getPeriodEntries } from "@/lib/stats/repo";
import { parsePeriod } from "@/lib/stats/schema";
import { getDefaultTarget } from "@/lib/targets/repo";

const macroRows = [
  { key: "proteinG", label: ru.targets.protein },
  { key: "fatG", label: ru.targets.fat },
  { key: "carbsG", label: ru.targets.carbs },
] as const;

async function StatsContent({ searchParams }: Pick<PageProps<"/stats">, "searchParams">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const period = parsePeriod((await searchParams).period);
  const from = addDays(today, 1 - STATS.days[period]);
  const [target, entries] = await Promise.all([
    getDefaultTarget(db, userId),
    getPeriodEntries(db, userId, from, today),
  ]);
  if (!target) redirect("/onboarding");
  const days = calcDayTotals(entries);
  const summary = calcPeriodSummary(days, target, today);
  const todayLogged = days.at(-1)?.date === today;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink />
      <h1 className="text-2xl font-semibold">{ru.stats.title}</h1>
      <PeriodSwitch current={period} />
      {days.length === 0 ? (
        <p className="text-foreground/60">{ru.stats.empty}</p>
      ) : (
        <>
          {summary.daysLogged === 0 ? (
            <p className="text-foreground/60">{ru.stats.noCompleteDays}</p>
          ) : (
            <section
              aria-label={ru.stats.averageTitle}
              className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-5"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-sm text-foreground/60">{ru.stats.averageTitle}</h2>
                <p className="text-3xl font-semibold">
                  {ru.diary.eatenOfTarget(
                    formatKcal(summary.average.kcal),
                    formatKcal(target.kcal),
                  )}{" "}
                  <span className="text-base font-normal">{ru.targets.kcalUnit}</span>
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                {macroRows.map((row) => (
                  <div key={row.key} className="flex flex-col gap-1">
                    <dt className="text-xs text-foreground/60">{row.label}</dt>
                    <dd className="text-sm font-medium">
                      {ru.diary.eatenOfTarget(
                        formatGrams(summary.average[row.key]),
                        formatGrams(target[row.key]),
                      )}{" "}
                      {ru.targets.gramsUnit}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  {ru.stats.daysInTarget(summary.daysInTarget, summary.daysLogged)}
                </p>
                <p className="text-sm text-foreground/60">
                  {ru.stats.inTargetHint}
                  {todayLogged ? ` ${ru.stats.todayExcluded}` : ""}
                </p>
              </div>
            </section>
          )}
          <KcalChart
            days={days}
            from={from}
            to={today}
            targetKcal={target.kcal}
            summary={summary}
          />
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{ru.stats.daysTitle}</h2>
            <ul className="flex flex-col divide-y divide-foreground/10">
              {days.toReversed().map((day) => (
                <li key={day.date}>
                  <Link
                    href={dayHref(day.date, today)}
                    className="flex min-h-11 items-center justify-between gap-3 py-2"
                  >
                    <span>
                      {formatDayLabel(day.date, today)}
                      {day.date === today && (
                        <span className="text-sm text-foreground/60">
                          {" "}
                          · {ru.stats.dayInProgress}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {ru.stats.kcal(formatKcal(day.nutrients.kcal))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

// The session and the time zone cookie are read at request time, so they stay behind a boundary.
export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <StatsContent searchParams={searchParams} />
    </Suspense>
  );
}
