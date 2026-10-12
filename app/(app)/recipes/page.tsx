import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { BackLink } from "@/components/ui/back-link";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { calcEntryNutrients } from "@/lib/nutrition";
import { NEW_RECIPE_HREF, recipeHref } from "@/lib/recipes/paths";
import { listRecipes } from "@/lib/recipes/repo";

async function RecipesContent() {
  const userId = await requireUserId();
  const recipes = await listRecipes(db, userId);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{ru.recipes.title}</h1>
        <Link
          href={NEW_RECIPE_HREF}
          className="flex min-h-11 items-center rounded-lg border border-foreground/20 px-4"
        >
          {ru.recipes.add}
        </Link>
      </div>
      {recipes.length === 0 ? (
        <p className="text-foreground/60">{ru.recipes.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link href={recipeHref(recipe.id)} className="flex min-h-11 flex-col gap-0.5 py-2">
                <span className="font-medium [overflow-wrap:anywhere]">{recipe.name}</span>
                <span className="text-sm text-foreground/60">
                  {ru.diary.kcalPer100g(formatKcal(recipe.per100g.kcal100))}
                  {recipe.servingGrams === null
                    ? null
                    : ru.recipes.listServing(
                        formatKcal(calcEntryNutrients(recipe.per100g, recipe.servingGrams).kcal),
                      )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// The session is read at request time, so it stays behind a boundary on every navigation.
export default function RecipesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RecipesContent />
    </Suspense>
  );
}
