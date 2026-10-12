import { ChoiceGroup } from "@/components/ui/form";
import { MEALS, type Meal } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

const mealOptions = MEALS.map((meal) => ({ value: meal, label: ru.diary.meals[meal] }));

export function MealPicker({ defaultValue, error }: { defaultValue: Meal; error?: string }) {
  return (
    <ChoiceGroup
      legend={ru.diary.mealLegend}
      name="meal"
      layout="grid"
      options={mealOptions}
      defaultValue={defaultValue}
      error={error}
    />
  );
}
