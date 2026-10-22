import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { DaySwitch } from "@/components/diary/day-switch";
import { QuickLists } from "@/components/diary/quick-lists";
import { FoodSearch } from "@/components/foods/food-search";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_SEARCH, QUICK } from "@/lib/config";
import { dayHref, diarySearch, quickKcalHref } from "@/lib/diary/paths";
import { parseAddError } from "@/lib/diary/quick";
import { listFavoriteFoods, listRecentFoods } from "@/lib/diary/quick-repo";
import { parseDiaryDate, parseMeal } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { countDayEntries } from "@/lib/diary/repo";
import { listOwnFoods } from "@/lib/foods/repo";
import { parseSearchQuery } from "@/lib/foods/search-query";
import { formatDayLabel } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";

async function AddContent({ searchParams }: Pick<PageProps<"/diary/add">, "searchParams">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const params = await searchParams;
  const date = parseDiaryDate(params.date, today);
  const meal = parseMeal(params.meal);
  if (!date || !meal) notFound();
  const [ownFoods, dayCount, favorites] = await Promise.all([
    listOwnFoods(db, userId, FOOD_SEARCH.limit),
    countDayEntries(db, userId, date),
    listFavoriteFoods(db, userId),
  ]);
  // Favorites are not repeated among recent foods.
  const recent = await listRecentFoods(
    db,
    userId,
    meal,
    QUICK.recentLimit,
    new Set(favorites.map((food) => food.foodId)),
  );
  const hasQuick = favorites.length > 0 || recent.length > 0;
  const addError = parseAddError(params.error);
  const query = parseSearchQuery(params[FOOD_SEARCH.queryParam]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={dayHref(date, today)} />
      <h1 className="text-2xl font-semibold">
        {ru.diary.addTitle(ru.diary.meals[meal], formatDayLabel(date, today))}
      </h1>
      {addError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {ru.diary.addErrors[addError]}
        </p>
      ) : null}
      <DaySwitch date={date} today={today} meal={meal} />
      <Link href={quickKcalHref(date, meal)} className="flex min-h-11 w-fit items-center underline text-accent-text">
        {ru.diary.quickKcalLink}
      </Link>
      {/* cacheComponents keeps this screen alive with its query; a new key after every add
          starts a fresh search, while Back from the amount step keeps the results. */}
      <FoodSearch
        key={`${date}:${meal}:${dayCount}:${query}`}
        ownFoods={ownFoods}
        initialQuery={query}
        link={{ prefix: "/diary/add/", search: diarySearch(date, meal) }}
        newFoodSearch={diarySearch(date, meal)}
        scan={{ kind: "diary", date, meal }}
        idle={
          hasQuick ? (
            <QuickLists favorites={favorites} recent={recent} date={date} meal={meal} />
          ) : undefined
        }
      />
    </main>
  );
}

export default function AddEntryPage({ searchParams }: PageProps<"/diary/add">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AddContent searchParams={searchParams} />
    </Suspense>
  );
}
