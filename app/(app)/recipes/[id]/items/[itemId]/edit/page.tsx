import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { deleteItemAction, updateItemAction } from "@/app/(app)/recipes/actions";
import type { AmountInitial, PortionOption } from "@/components/diary/amount-fields";
import { ItemAmountForm } from "@/components/recipes/item-amount-form";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageLoading } from "@/components/ui/page-loading";
import { requireUserId } from "@/lib/auth/session";
import { DIARY_LIMITS } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { parseId } from "@/lib/ids";
import { calcEntryNutrients } from "@/lib/nutrition";
import { recipeHref } from "@/lib/recipes/paths";
import { getRecipe } from "@/lib/recipes/repo";

async function EditIngredientContent({
  params,
}: Pick<PageProps<"/recipes/[id]/items/[itemId]/edit">, "params">) {
  const userId = await requireUserId();
  const raw = await params;
  const recipeId = parseId(raw.id);
  const itemId = parseId(raw.itemId);
  if (!recipeId || !itemId) notFound();
  const recipe = await getRecipe(db, userId, recipeId);
  const item = recipe?.items.find((candidate) => candidate.id === itemId);
  if (!recipe || !item) notFound();

  const portion: PortionOption | null =
    item.portionLabel !== null && item.portionGrams !== null
      ? {
          id: null,
          label: item.portionLabel,
          grams: item.portionGrams,
          kcal: calcEntryNutrients(item.per100g, item.portionGrams).kcal,
        }
      : null;
  const initial: AmountInitial = {
    mode: portion && item.portionCount !== null ? "portion" : "grams",
    portionIndex: 0,
    count: item.portionCount ?? DIARY_LIMITS.portionCount.default,
    grams: item.grams,
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <BackLink href={recipeHref(recipe.id)} />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-foreground/60">{ru.recipes.editIngredientTitle}</p>
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{item.foodName}</h1>
      </div>
      {/* Keyed by the stored values so a revisit after saving never re-saves the old amount. */}
      <ItemAmountForm
        key={`${item.id}:${item.grams}:${item.portionCount}`}
        action={updateItemAction.bind(null, recipe.id, item.id)}
        portions={portion ? [portion] : []}
        initial={initial}
        submitLabel={ru.common.save}
      />
      <ConfirmDeleteButton action={deleteItemAction.bind(null, recipe.id, item.id)} />
    </main>
  );
}

export default function EditIngredientPage({
  params,
}: PageProps<"/recipes/[id]/items/[itemId]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditIngredientContent params={params} />
    </Suspense>
  );
}
