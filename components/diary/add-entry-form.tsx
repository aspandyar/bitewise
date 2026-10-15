"use client";

import { addEntryAction } from "@/app/(app)/diary/actions";
import { FormError, SubmitButton, usePreservingFormAction } from "@/components/ui/form";
import { DIARY_LIMITS, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { ru } from "@/lib/i18n/ru";
import type { Per100g } from "@/lib/nutrition";
import { AmountFields, type PortionOption } from "./amount-fields";
import { MealPicker } from "./meal-picker";

export function AddEntryForm({
  date,
  foodId,
  meal,
  portions,
  per100g,
}: {
  date: IsoDate;
  foodId: string;
  meal: Meal;
  portions: PortionOption[];
  per100g: Per100g;
}) {
  const {
    state,
    pending,
    fieldErrors: errors,
    formProps,
  } = usePreservingFormAction(addEntryAction);
  return (
    <form {...formProps} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="foodId" value={foodId} />
      {/* A food with portions opens on them: one tap on "1 шт" beats typing grams. */}
      <AmountFields
        portions={portions}
        initial={{
          mode: portions.length > 0 ? "portion" : "grams",
          portionIndex: 0,
          count: DIARY_LIMITS.portionCount.default,
          grams: DIARY_LIMITS.grams.default,
        }}
        errors={errors}
        per100g={per100g}
      />
      <MealPicker defaultValue={meal} error={errors.meal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.diary.submitAdd}</SubmitButton>
    </form>
  );
}
