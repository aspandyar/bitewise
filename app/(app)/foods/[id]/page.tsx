import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { CopyFoodButton, DeleteFoodButton } from "@/components/foods/food-actions";
import { Portions } from "@/components/foods/portions";
import { toggleFavoriteAction } from "@/app/(app)/diary/actions";
import { FavoriteButton } from "@/components/foods/favorite-button";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { requireUserId } from "@/lib/auth/session";
import { isFavorite } from "@/lib/diary/quick-repo";
import { formatGrams, formatKcal } from "@/lib/format";
import { getVisibleFood, listVisiblePortions } from "@/lib/foods/repo";
import { parseFoodId } from "@/lib/foods/schema";
import { safeSourceUrl } from "@/lib/foods/source-url";
import { ru } from "@/lib/i18n/ru";
import { calcEntryNutrients } from "@/lib/nutrition";
import { recipeHref } from "@/lib/recipes/paths";
import { getRecipeIdByFoodId } from "@/lib/recipes/repo";

async function FoodContent({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const foodId = parseFoodId((await params).id);
  if (!foodId) notFound();
  const [food, portions, starred] = await Promise.all([
    getVisibleFood(db, userId, foodId),
    listVisiblePortions(db, userId, foodId),
    isFavorite(db, userId, foodId),
  ]);
  if (!food) notFound();
  // A dish found in search opens as a recipe: its numbers are edited through the ingredients.
  if (food.isRecipe) {
    const recipeId = await getRecipeIdByFoodId(db, userId, food.id);
    if (!recipeId) notFound();
    redirect(recipeHref(recipeId));
  }

  const rows = [
    { label: ru.targets.protein, grams: food.protein100 },
    { label: ru.targets.fat, grams: food.fat100 },
    { label: ru.foods.carbsNet, grams: food.carbs100 },
    ...(food.fiber100 === null ? [] : [{ label: ru.foods.fiber, grams: food.fiber100 }]),
  ];
  const sourceUrl = safeSourceUrl(food.sourceUrl);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href="/foods" />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{food.name}</h1>
        <FavoriteButton active={starred} action={toggleFavoriteAction.bind(null, food.id)} />
      </div>
      <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-5">
        <p className="text-3xl font-semibold">
          {formatKcal(food.kcal100)}{" "}
          <span className="text-base font-normal">
            {ru.targets.kcalUnit} {ru.foods.per100g}
          </span>
        </p>
        <dl className="grid grid-cols-2 gap-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col justify-between gap-1 rounded-lg bg-foreground/5 px-3 py-2"
            >
              <dt className="text-xs text-foreground/60">{row.label}</dt>
              <dd className="font-medium">
                {formatGrams(row.grams)} {ru.targets.gramsUnit}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-foreground/60">
          {ru.foods.sourceLabel}{" "}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {ru.foods.sourceNames[food.source]}
            </a>
          ) : (
            ru.foods.sourceNames[food.source]
          )}
          {food.copiedFrom ? ru.foods.copiedFrom(ru.foods.sourceNames[food.copiedFrom]) : null}
        </p>
      </section>
      {food.isOwn ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/foods/${food.id}/edit`}
            className="flex min-h-11 items-center rounded-lg border border-foreground/40 px-4"
          >
            {ru.foods.edit}
          </Link>
          <DeleteFoodButton foodId={food.id} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground/60">{ru.foods.copyHint}</p>
          <CopyFoodButton foodId={food.id} />
        </div>
      )}
      <ResetOnHide>
        <Portions
          foodId={food.id}
          portions={portions.map((portion) => ({
            ...portion,
            kcal: calcEntryNutrients(food, portion.grams).kcal,
          }))}
        />
      </ResetOnHide>
    </main>
  );
}

export default function FoodPage({ params }: PageProps<"/foods/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <FoodContent params={params} />
    </Suspense>
  );
}
