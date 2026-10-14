"use client";

import { FormError, SubmitButton, usePreservingFormAction } from "@/components/ui/form";
import type { Meal } from "@/lib/config";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { AmountFields, type AmountInitial, type PortionOption } from "./amount-fields";
import { MealPicker } from "./meal-picker";

export function EditEntryForm({
  action,
  meal,
  portions,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  meal: Meal;
  portions: PortionOption[];
  initial: AmountInitial;
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-5">
      <AmountFields portions={portions} initial={initial} errors={errors} />
      <MealPicker defaultValue={meal} error={errors.meal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
