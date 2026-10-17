import Link from "next/link";
import { RECIPE_LIMITS } from "@/lib/config";
import { formatEntryAmount, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { ingredientEditHref, ingredientSearchHref } from "@/lib/recipes/paths";
import type { RecipeItemRow } from "@/lib/recipes/types";

export type IngredientRow = RecipeItemRow & { kcal: number };

export function IngredientList({
  recipeId,
  items,
  canAdd,
}: {
  recipeId: string;
  items: IngredientRow[];
  canAdd: boolean;
}) {
  return (
    <section aria-labelledby="ingredients" className="flex flex-col gap-1">
      <h2 id="ingredients" className="font-medium">
        {ru.recipes.ingredientsTitle}
      </h2>
      {items.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={ingredientEditHref(recipeId, item.id)}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="[overflow-wrap:anywhere]">
                    {item.foodName}
                    {item.foodDeleted ? (
                      <span className="ml-2 rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
                        {ru.recipes.deletedFood}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-foreground/60">{formatEntryAmount(item)}</span>
                </span>
                <span className="shrink-0 text-sm">
                  {formatKcal(item.kcal)} {ru.targets.kcalUnit}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-foreground/60">{ru.recipes.noIngredients}</p>
      )}
      {canAdd ? (
        <Link
          href={ingredientSearchHref(recipeId)}
          className="flex min-h-11 w-fit items-center text-sm underline text-accent-text"
        >
          {ru.recipes.addIngredient}
        </Link>
      ) : (
        <p className="text-sm text-foreground/60">{ru.recipes.itemLimit(RECIPE_LIMITS.maxItems)}</p>
      )}
    </section>
  );
}
