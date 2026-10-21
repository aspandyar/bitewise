import Link from "next/link";
import { quickAddAction } from "@/app/(app)/diary/actions";
import { KeyedForm } from "@/components/ui/keyed-form";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { addFoodHref } from "@/lib/diary/paths";
import type { QuickFood } from "@/lib/diary/quick-repo";
import { formatEntryAmount, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import { QuickAddButton } from "./quick-add-button";

function QuickRow({ food, date, meal }: { food: QuickFood; date: IsoDate; meal: Meal }) {
  const amountHref = addFoodHref(food.foodId, date, meal);
  // Never logged: there is no amount to repeat, so the row opens the amount screen.
  if (food.amount === null || food.kcal === null) {
    return (
      <li>
        <Link
          href={amountHref}
          className="flex min-h-11 items-center py-2 [overflow-wrap:anywhere]"
        >
          {food.name}
        </Link>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2">
      <KeyedForm
        action={quickAddAction.bind(null, food.foodId, date, meal)}
        className="min-w-0 flex-1"
      >
        <QuickAddButton>
          <span className="[overflow-wrap:anywhere]">{food.name}</span>
          <span className="text-sm text-foreground/60">
            {ru.diary.quickAmount(formatEntryAmount(food.amount), formatKcal(food.kcal))}
          </span>
        </QuickAddButton>
      </KeyedForm>
      <Link
        href={amountHref}
        aria-label={ru.diary.otherAmount(food.name)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-foreground/20"
      >
        {ru.diary.otherAmountSymbol}
      </Link>
    </li>
  );
}

function QuickSection({
  title,
  foods,
  date,
  meal,
}: {
  title: string;
  foods: QuickFood[];
  date: IsoDate;
  meal: Meal;
}) {
  if (foods.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-medium text-foreground/60">{title}</h2>
      <ul className="flex flex-col divide-y divide-foreground/10">
        {foods.map((food) => (
          <QuickRow key={food.foodId} food={food} date={date} meal={meal} />
        ))}
      </ul>
    </section>
  );
}

// Tapping a row logs the food again with its last amount; "…" opens the amount screen.
export function QuickLists({
  favorites,
  recent,
  date,
  meal,
}: {
  favorites: QuickFood[];
  recent: QuickFood[];
  date: IsoDate;
  meal: Meal;
}) {
  return (
    <div className="flex flex-col gap-4">
      <QuickSection title={ru.diary.favoritesTitle} foods={favorites} date={date} meal={meal} />
      <QuickSection title={ru.diary.recentTitle} foods={recent} date={date} meal={meal} />
    </div>
  );
}
