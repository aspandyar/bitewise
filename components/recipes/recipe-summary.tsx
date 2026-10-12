import { formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import type { Nutrients, Per100g } from "@/lib/nutrition";

// Every number arrives computed by the server page; this component only lays them out.
export function RecipeSummary({
  per100g,
  totals,
  weightG,
  serving,
  weightRaised,
}: {
  per100g: Per100g;
  totals: Nutrients;
  weightG: number;
  serving: { grams: number; kcal: number } | null;
  weightRaised: boolean;
}) {
  const macros = [
    { label: ru.targets.protein, grams: per100g.protein100 },
    { label: ru.targets.fat, grams: per100g.fat100 },
    { label: ru.targets.carbs, grams: per100g.carbs100 },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-5">
      <p className="text-3xl font-semibold">
        {formatKcal(per100g.kcal100)}{" "}
        <span className="text-base font-normal">
          {ru.targets.kcalUnit} {ru.foods.per100g}
        </span>
      </p>
      <dl className="grid grid-cols-3 gap-2">
        {macros.map((row) => (
          <div key={row.label} className="rounded-lg bg-foreground/5 px-3 py-2">
            <dt className="text-xs text-foreground/60">{row.label}</dt>
            <dd className="font-medium">
              {formatGrams(row.grams)} {ru.targets.gramsUnit}
            </dd>
          </div>
        ))}
      </dl>
      {serving ? (
        <p>{ru.recipes.serving(formatGrams(serving.grams), formatKcal(serving.kcal))}</p>
      ) : null}
      <p className="text-sm text-foreground/60">
        {ru.recipes.whole(formatGrams(weightG), formatKcal(totals.kcal))}
      </p>
      {weightRaised ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {ru.recipes.weightRaised}
        </p>
      ) : null}
    </section>
  );
}
