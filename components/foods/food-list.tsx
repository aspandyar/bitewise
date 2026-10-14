import Link from "next/link";
import { formatGrams, formatKcal } from "@/lib/format";
import type { FoodListItem } from "@/lib/foods/types";
import { ru } from "@/lib/i18n/ru";

const foodCardHref = (food: FoodListItem) => `/foods/${food.id}`;

export function FoodList({
  items,
  hrefFor = foodCardHref,
}: {
  items: FoodListItem[];
  hrefFor?: (food: FoodListItem) => string;
}) {
  return (
    <ul className="flex flex-col divide-y divide-foreground/10">
      {items.map((food) => (
        <li key={food.id}>
          <Link href={hrefFor(food)} className="flex min-h-11 flex-col gap-0.5 py-2">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{food.name}</span>
              <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
                {food.isRecipe ? ru.recipes.badge : ru.foods.sources[food.source]}
              </span>
            </span>
            <span className="text-sm text-foreground/60">
              {ru.foods.listSummary(
                formatKcal(food.kcal100),
                formatGrams(food.protein100),
                formatGrams(food.fat100),
                formatGrams(food.carbs100),
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
