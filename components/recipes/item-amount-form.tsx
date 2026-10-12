"use client";

import {
  AmountFields,
  type AmountInitial,
  type PortionOption,
} from "@/components/diary/amount-fields";
import { FormError, SubmitButton, usePreservingFormAction } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";

export function ItemAmountForm({
  action,
  portions,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  portions: PortionOption[];
  initial: AmountInitial;
  submitLabel: string;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction(action);
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <AmountFields portions={portions} initial={initial} errors={errors} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
