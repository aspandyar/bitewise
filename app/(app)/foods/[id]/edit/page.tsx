import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { updateFoodAction } from "@/app/(app)/foods/actions";
import { FoodForm } from "@/components/foods/food-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { getVisibleFood } from "@/lib/foods/repo";
import { parseFoodId } from "@/lib/foods/schema";
import { ru } from "@/lib/i18n/ru";

async function EditFoodContent({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const foodId = parseFoodId((await params).id);
  if (!foodId) notFound();
  const food = await getVisibleFood(db, userId, foodId);
  // Shared foods are read-only: copying is the way to change their numbers.
  if (!food?.isOwn) notFound();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={`/foods/${food.id}`} />
      <h1 className="text-2xl font-semibold">{ru.foods.editTitle}</h1>
      <FoodForm action={updateFoodAction.bind(null, food.id)} initial={food} />
    </main>
  );
}

export default function EditFoodPage({ params }: PageProps<"/foods/[id]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditFoodContent params={params} />
    </Suspense>
  );
}
