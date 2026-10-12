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
  portion,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  meal: Meal;
  portion: PortionOption | null;
  initial: AmountInitial;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction(action);
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <AmountFields portions={portion ? [portion] : []} initial={initial} errors={errors} />
      <MealPicker defaultValue={meal} error={errors.meal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
