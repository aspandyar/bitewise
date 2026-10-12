import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DayNav } from "@/components/diary/day-nav";
import { DaySummary } from "@/components/diary/day-summary";
import { MealSection, type EntryRow } from "@/components/diary/meal-section";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { MEALS } from "@/lib/config";
import { getDayEntries } from "@/lib/diary/repo";
import { parseDiaryDate } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { calcDayProgress, calcEntryNutrients, sumNutrients } from "@/lib/nutrition";
import { getDefaultTarget } from "@/lib/targets/repo";

const navLinks = [
  { href: "/foods", label: ru.foods.title },
  { href: "/targets", label: ru.targets.editTargets },
  { href: "/profile", label: ru.targets.editProfile },
] as const;

async function DayContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const rawDate = (await searchParams).date;
  const date = rawDate === undefined ? today : parseDiaryDate(rawDate, today);
  if (!date) notFound();
  const [target, entries] = await Promise.all([
    getDefaultTarget(db, userId),
    getDayEntries(db, userId, date),
  ]);
  if (!target) redirect("/onboarding");

  const rows: EntryRow[] = entries.map((entry) => ({
    ...entry,
    nutrients: calcEntryNutrients(entry, entry.grams),
  }));
  const progress = calcDayProgress(target, sumNutrients(rows.map((row) => row.nutrients)));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <DayNav date={date} today={today} />
      <DaySummary progress={progress} />
      {MEALS.map((meal) => {
        const mealRows = rows.filter((row) => row.meal === meal);
        return (
          <MealSection
            key={meal}
            meal={meal}
            date={date}
            rows={mealRows}
            kcal={sumNutrients(mealRows.map((row) => row.nutrients)).kcal}
          />
        );
      })}
      <nav className="flex flex-col gap-2">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <SignOutButton />
    </main>
  );
}

// The session and the time zone cookie are read at request time, so they stay behind a boundary.
export default function DayPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <DayContent searchParams={searchParams} />
    </Suspense>
  );
}
