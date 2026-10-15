"use client";

import {
  AmountFields,
  type AmountInitial,
  type PortionOption,
} from "@/components/diary/amount-fields";
import { FormError, SubmitButton, usePreservingFormAction } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";
import type { Per100g } from "@/lib/nutrition";

export function ItemAmountForm({
  action,
  portions,
  initial,
  submitLabel,
  per100g,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  portions: PortionOption[];
  initial: AmountInitial;
  submitLabel: string;
  per100g: Per100g;
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-5">
      <AmountFields portions={portions} initial={initial} errors={errors} per100g={per100g} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
