import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { FoodSearch } from "@/components/foods/food-search";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { FOOD_SEARCH } from "@/lib/config";
import { listOwnFoods } from "@/lib/foods/repo";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { ingredientAmountPrefix, recipeHref } from "@/lib/recipes/paths";
import { getRecipe } from "@/lib/recipes/repo";

async function IngredientSearchContent({ params }: Pick<PageProps<"/recipes/[id]/add">, "params">) {
  const userId = await requireUserId();
  const recipeId = parseId((await params).id);
  if (!recipeId) notFound();
  const [recipe, ownFoods] = await Promise.all([
    getRecipe(db, userId, recipeId),
    listOwnFoods(db, userId, FOOD_SEARCH.limit, { excludeRecipes: true }),
  ]);
  if (!recipe) notFound();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={recipeHref(recipe.id)} />
      <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">
        {ru.recipes.addIngredientTitle(recipe.name)}
      </h1>
      {/* A new key after every added ingredient starts a fresh search; Back from the amount
          step keeps the results. */}
      <FoodSearch
        key={`${recipe.id}:${recipe.updatedAt.getTime()}`}
        ownFoods={ownFoods}
        link={{ prefix: ingredientAmountPrefix(recipe.id) }}
        excludeRecipes
      />
    </main>
  );
}

export default function IngredientSearchPage({ params }: PageProps<"/recipes/[id]/add">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <IngredientSearchContent params={params} />
    </Suspense>
  );
}
