import { Suspense } from "react";
import { createFoodAction } from "@/app/(app)/foods/actions";
import { FoodForm } from "@/components/foods/food-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";

async function NewFoodContent() {
  await requireUserId();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href="/foods" />
      <h1 className="text-2xl font-semibold">{ru.foods.newTitle}</h1>
      <FoodForm action={createFoodAction} />
    </main>
  );
}

export default function NewFoodPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewFoodContent />
    </Suspense>
  );
}
