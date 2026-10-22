import { Suspense } from "react";
import { createFoodAction } from "@/app/(app)/foods/actions";
import { FoodForm } from "@/components/foods/food-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { addHref } from "@/lib/diary/paths";
import { parseEntryContext } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { parseFoodHints } from "@/lib/foods/hints";
import { parseSearchQuery, withSearchQuery } from "@/lib/foods/search-query";
import { ru } from "@/lib/i18n/ru";

async function NewFoodContent({ searchParams }: Pick<PageProps<"/foods/new">, "searchParams">) {
  await requireUserId();
  const params = await searchParams;
  const draft = parseFoodHints(params);
  const entry = parseEntryContext(params.date, params.meal, await getUserToday(new Date()));
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      {/* Without a code the name is the search it was started from: Back reopens that search
          (#92). A scan's name came from the pack, so Back opens a plain search. */}
      <BackLink
        href={withSearchQuery(
          entry ? addHref(entry.date, entry.meal) : "/foods",
          draft.barcode ? undefined : parseSearchQuery(params.name),
        )}
      />
      <h1 className="text-2xl font-semibold">{ru.foods.newTitle}</h1>
      <ResetOnHide>
        {/* Keyed by the draft: a cached screen opened from another search or scan shows that one. */}
        <FoodForm
          key={`${JSON.stringify(draft)}:${entry?.date}:${entry?.meal}`}
          action={createFoodAction}
          draft={draft}
          entry={entry ?? undefined}
        />
      </ResetOnHide>
    </main>
  );
}

export default function NewFoodPage({ searchParams }: PageProps<"/foods/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewFoodContent searchParams={searchParams} />
    </Suspense>
  );
}
