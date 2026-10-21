import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { deleteRecipeAction } from "@/app/(app)/recipes/actions";
import { IngredientList } from "@/components/recipes/ingredient-list";
import { RecipeSummary } from "@/components/recipes/recipe-summary";
import { setFavoriteAction } from "@/app/(app)/diary/actions";
import { FavoriteButton } from "@/components/foods/favorite-button";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { isFavorite } from "@/lib/diary/quick-repo";
import { RECIPE_LIMITS } from "@/lib/config";
import { hourInTimeZone } from "@/lib/date";
import { mealForHour } from "@/lib/diary/quick";
import { addFoodHref } from "@/lib/diary/paths";
import { getUserTimeZone, getUserToday } from "@/lib/diary/today";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { calcEntryNutrients, calcRecipe, calcServingPortionGrams } from "@/lib/nutrition";
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
  const starred = await isFavorite(db, userId, recipe.foodId);
  // Logged right after cooking or eating: the meal follows the hour, and can be changed there.
  const mealNow = mealForHour(hourInTimeZone(new Date(), await getUserTimeZone()));

  const result = calcRecipe(recipe.items, recipe.cookedWeightG);
  const servingGrams = calcServingPortionGrams(result.weightG, recipe.servings);
  const items = recipe.items.map((item) => ({
    ...item,
    kcal: calcEntryNutrients(item.per100g, item.grams).kcal,
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href={RECIPES_HREF} />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{recipe.name}</h1>
        <FavoriteButton
          active={starred}
          action={setFavoriteAction.bind(null, recipe.foodId, !starred)}
        />
      </div>
      <RecipeSummary
        per100g={result.per100g}
        totals={result.totals}
        weightG={result.weightG}
        serving={
          servingGrams === null
            ? null
            : { grams: servingGrams, kcal: calcEntryNutrients(result.per100g, servingGrams).kcal }
        }
        weightRaised={result.weightRaised}
      />
      {/* An empty dish is 0 kcal: there is nothing to log until it has ingredients. */}
      {recipe.items.length > 0 ? (
        <Link
          href={addFoodHref(recipe.foodId, today, mealNow, { recipeId: recipe.id })}
          className="flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-on-accent"
        >
          {ru.recipes.toDiary}
        </Link>
      ) : null}
      <IngredientList
        recipeId={recipe.id}
        items={items}
        canAdd={recipe.items.length < RECIPE_LIMITS.maxItems}
      />
      {/* One row, as on the food card (#83); the confirm buttons wrap below when they need room. */}
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
