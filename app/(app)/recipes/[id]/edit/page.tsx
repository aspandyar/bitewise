import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { updateRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { BackLink } from "@/components/ui/back-link";
import { ResetOnHide } from "@/components/ui/reset-on-hide";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { recipeHref } from "@/lib/recipes/paths";
import { getRecipe } from "@/lib/recipes/repo";

async function EditRecipeContent({ params }: Pick<PageProps<"/recipes/[id]/edit">, "params">) {
  const userId = await requireUserId();
  const recipeId = parseId((await params).id);
  if (!recipeId) notFound();
  const recipe = await getRecipe(db, userId, recipeId);
  if (!recipe) notFound();
  const initial = {
    name: recipe.name,
    cookedWeightG: recipe.cookedWeightG,
    servings: recipe.servings,
  };
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={recipeHref(recipe.id)} />
      <h1 className="text-2xl font-semibold">{ru.recipes.editTitle}</h1>
      {/* Keyed by the stored values so a revisit after saving never shows the old ones. */}
      <ResetOnHide>
        <RecipeForm
          key={`${recipe.id}:${recipe.name}:${recipe.cookedWeightG}:${recipe.servings}`}
          action={updateRecipeAction.bind(null, recipe.id)}
          initial={initial}
        />
      </ResetOnHide>
    </main>
  );
}

export default function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditRecipeContent params={params} />
    </Suspense>
  );
}
