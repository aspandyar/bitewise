import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { AddEntryForm } from "@/components/diary/add-entry-form";
import type { PortionOption } from "@/components/diary/amount-fields";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { addHref } from "@/lib/diary/paths";
import { parseDiaryDate, parseId, parseMeal } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { getVisibleFood, listVisiblePortions } from "@/lib/foods/repo";
import { formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { calcEntryNutrients } from "@/lib/nutrition";

async function AmountContent({
  params,
  searchParams,
}: Pick<PageProps<"/diary/add/[foodId]">, "params" | "searchParams">) {
  const userId = await requireUserId();
  const today = await getUserToday(new Date());
  const [{ foodId: rawFoodId }, query] = await Promise.all([params, searchParams]);
  const foodId = parseId(rawFoodId);
  const date = parseDiaryDate(query.date, today);
  const meal = parseMeal(query.meal);
  if (!foodId || !date || !meal) notFound();
  const [food, portions] = await Promise.all([
    getVisibleFood(db, userId, foodId),
    listVisiblePortions(db, userId, foodId),
  ]);
  if (!food) notFound();
  const options: PortionOption[] = portions.map((portion) => ({
    id: portion.id,
    label: portion.label,
    grams: portion.grams,
    kcal: calcEntryNutrients(food, portion.grams).kcal,
  }));
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={addHref(date, meal)} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{food.name}</h1>
        <p className="text-foreground/60">{ru.diary.kcalPer100g(formatKcal(food.kcal100))}</p>
      </div>
      <AddEntryForm date={date} foodId={food.id} meal={meal} portions={options} />
    </main>
  );
}

export default function AddAmountPage({ params, searchParams }: PageProps<"/diary/add/[foodId]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AmountContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
