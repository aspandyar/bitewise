import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { addItemAction } from "@/app/(app)/recipes/actions";
import type { PortionOption } from "@/components/diary/amount-fields";
import { ItemAmountForm } from "@/components/recipes/item-amount-form";
import { BackLink } from "@/components/ui/back-link";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { DIARY_LIMITS } from "@/lib/config";
import { getVisibleFood, listVisiblePortions } from "@/lib/foods/repo";
import { formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { calcEntryNutrients } from "@/lib/nutrition";
import { ingredientSearchHref } from "@/lib/recipes/paths";
import { getRecipe } from "@/lib/recipes/repo";

async function IngredientAmountContent({
  params,
}: Pick<PageProps<"/recipes/[id]/add/[foodId]">, "params">) {
  const userId = await requireUserId();
  const raw = await params;
  const recipeId = parseId(raw.id);
  const foodId = parseId(raw.foodId);
  if (!recipeId || !foodId) notFound();
  const [recipe, food, portions] = await Promise.all([
    getRecipe(db, userId, recipeId),
    getVisibleFood(db, userId, foodId),
    listVisiblePortions(db, userId, foodId),
  ]);
  // A dish inside a dish is not supported; the server action refuses it too.
  if (!recipe || !food || food.isRecipe) notFound();
  const options: PortionOption[] = portions.map((portion) => ({
    id: portion.id,
    label: portion.label,
    grams: portion.grams,
    kcal: calcEntryNutrients(food, portion.grams).kcal,
  }));
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={ingredientSearchHref(recipe.id)} />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-foreground/60 [overflow-wrap:anywhere]">{recipe.name}</p>
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{food.name}</h1>
        <p className="text-foreground/60">{ru.diary.kcalPer100g(formatKcal(food.kcal100))}</p>
      </div>
      <ResetOnHide>
        <ItemAmountForm
          key={`${recipe.id}:${food.id}:${recipe.updatedAt.getTime()}`}
          action={addItemAction.bind(null, recipe.id, food.id)}
          portions={options}
          initial={{
            mode: options.length > 0 ? "portion" : "grams",
            portionIndex: 0,
            count: DIARY_LIMITS.portionCount.default,
            grams: DIARY_LIMITS.grams.default,
          }}
          submitLabel={ru.recipes.submitAddIngredient}
        />
      </ResetOnHide>
    </main>
  );
}

export default function IngredientAmountPage({ params }: PageProps<"/recipes/[id]/add/[foodId]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <IngredientAmountContent params={params} />
    </Suspense>
  );
}
