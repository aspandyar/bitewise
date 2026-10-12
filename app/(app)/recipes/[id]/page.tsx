import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { deleteRecipeAction } from "@/app/(app)/recipes/actions";
import { IngredientList } from "@/components/recipes/ingredient-list";
import { RecipeSummary } from "@/components/recipes/recipe-summary";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { DIARY_DEFAULT_MEAL, RECIPE_LIMITS } from "@/lib/config";
import { addFoodHref } from "@/lib/diary/paths";
import { getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { calcEntryNutrients, calcRecipe, calcServingGrams } from "@/lib/nutrition";
import { RECIPES_HREF, recipeEditHref } from "@/lib/recipes/paths";
import { getRecipe } from "@/lib/recipes/repo";

const action = "flex min-h-11 items-center rounded-lg border border-foreground/40 px-4";

async function RecipeContent({ params }: Pick<PageProps<"/recipes/[id]">, "params">) {
  const userId = await requireUserId();
  const recipeId = parseId((await params).id);
  if (!recipeId) notFound();
  const [recipe, today] = await Promise.all([
    getRecipe(db, userId, recipeId),
    getUserToday(new Date()),
  ]);
  if (!recipe) notFound();

  const result = calcRecipe(recipe.items, recipe.cookedWeightG);
  const servingGrams =
    recipe.servings === null ? 0 : calcServingGrams(result.weightG, recipe.servings);
  const items = recipe.items.map((item) => ({
    ...item,
    kcal: calcEntryNutrients(item.per100g, item.grams).kcal,
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href={RECIPES_HREF} />
      <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{recipe.name}</h1>
      <RecipeSummary
        per100g={result.per100g}
        totals={result.totals}
        weightG={result.weightG}
        serving={
          servingGrams > 0
            ? { grams: servingGrams, kcal: calcEntryNutrients(result.per100g, servingGrams).kcal }
            : null
        }
        weightRaised={result.weightRaised}
      />
      <Link
        href={addFoodHref(recipe.foodId, today, DIARY_DEFAULT_MEAL)}
        className="flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 font-medium text-background"
      >
        {ru.recipes.toDiary}
      </Link>
      <IngredientList
        recipeId={recipe.id}
        items={items}
        canAdd={recipe.items.length < RECIPE_LIMITS.maxItems}
      />
      <div className="flex flex-wrap gap-2">
        <Link href={recipeEditHref(recipe.id)} className={action}>
          {ru.recipes.edit}
        </Link>
        <ConfirmDeleteButton action={deleteRecipeAction.bind(null, recipe.id)} />
      </div>
    </main>
  );
}

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RecipeContent params={params} />
    </Suspense>
  );
}
