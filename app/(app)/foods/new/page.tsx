import { Suspense } from "react";
import { createFoodAction } from "@/app/(app)/foods/actions";
import { FoodForm } from "@/components/foods/food-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { parseDraftName } from "@/lib/foods/schema";
import { ru } from "@/lib/i18n/ru";

async function NewFoodContent({ searchParams }: Pick<PageProps<"/foods/new">, "searchParams">) {
  await requireUserId();
  const draftName = parseDraftName((await searchParams).name);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href="/foods" />
      <h1 className="text-2xl font-semibold">{ru.foods.newTitle}</h1>
      <ResetOnHide>
        {/* Keyed by the draft: a cached screen opened from another search shows that query. */}
        <FoodForm key={draftName} action={createFoodAction} draftName={draftName} />
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
