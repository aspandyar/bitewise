import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { FoodSearch } from "@/components/foods/food-search";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_SEARCH, USDA_FDC_URL } from "@/lib/config";
import { listOwnFoods } from "@/lib/foods/repo";
import { parseSearchQuery } from "@/lib/foods/search-query";
import { ru } from "@/lib/i18n/ru";

async function FoodsContent({ searchParams }: Pick<PageProps<"/foods">, "searchParams">) {
  const userId = await requireUserId();
  const query = parseSearchQuery((await searchParams)[FOOD_SEARCH.queryParam]);
  const ownFoods = await listOwnFoods(db, userId, FOOD_SEARCH.limit);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{ru.foods.title}</h1>
        <Link
          href="/foods/new"
          className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4"
        >
          {ru.foods.add}
        </Link>
      </div>
      {/* Keyed by the query: a screen kept alive from another search starts from this one. */}
      <FoodSearch key={query} ownFoods={ownFoods} initialQuery={query} />
      <p className="mt-auto pt-4 text-xs text-foreground/60">
        {ru.foods.attribution}{" "}
        <a
          href={USDA_FDC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline text-accent-text"
        >
          {ru.foods.sourceNames.usda}
        </a>
      </p>
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function FoodsPage({ searchParams }: PageProps<"/foods">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <FoodsContent searchParams={searchParams} />
    </Suspense>
  );
}
