import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { FoodSearch } from "@/components/foods/food-search";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_SEARCH } from "@/lib/config";
import { dayHref, diarySearch } from "@/lib/diary/paths";
import { parseDiaryDate, parseMeal } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { listOwnFoods } from "@/lib/foods/repo";
import { formatDayLabel } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";

async function AddContent({ searchParams }: Pick<PageProps<"/diary/add">, "searchParams">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const params = await searchParams;
  const date = parseDiaryDate(params.date, today);
  const meal = parseMeal(params.meal);
  if (!date || !meal) notFound();
  const ownFoods = await listOwnFoods(db, userId, FOOD_SEARCH.limit);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={dayHref(date, today)} />
      <h1 className="text-2xl font-semibold">
        {ru.diary.addTitle(ru.diary.meals[meal], formatDayLabel(date, today))}
      </h1>
      <FoodSearch
        ownFoods={ownFoods}
        link={{ prefix: "/diary/add/", search: diarySearch(date, meal) }}
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
