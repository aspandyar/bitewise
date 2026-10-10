import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { FoodSearch } from "@/components/foods/food-search";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_SEARCH } from "@/lib/config";
import { listOwnFoods } from "@/lib/foods/repo";
import { ru } from "@/lib/i18n/ru";

async function FoodsContent() {
  const userId = await requireUserId();
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
      <FoodSearch ownFoods={ownFoods} />
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function FoodsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FoodsContent />
    </Suspense>
  );
}
