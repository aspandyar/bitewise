import { Suspense } from "react";
import { db } from "@/db/client";
import { createRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { ru } from "@/lib/i18n/ru";
import { RECIPES_HREF } from "@/lib/recipes/paths";
import { countRecipes } from "@/lib/recipes/repo";

async function NewRecipeContent() {
  const userId = await requireUserId();
  const recipeCount = await countRecipes(db, userId);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={RECIPES_HREF} />
      <h1 className="text-2xl font-semibold">{ru.recipes.newTitle}</h1>
      {/* cacheComponents keeps this screen alive; a new key after every created recipe opens an
          empty form instead of the previous dish's name. */}
      <RecipeForm key={recipeCount} action={createRecipeAction} />
    </main>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewRecipeContent />
    </Suspense>
  );
}
