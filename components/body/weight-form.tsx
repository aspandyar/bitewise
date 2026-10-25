"use client";

import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { formatInputNumber } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";

export function WeightForm({
  action,
  label,
  initialKg,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  initialKg: number | null;
}) {
  const { state, pending, fieldErrors, formProps } = usePreservingFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <TextField
        label={label}
        name="weightKg"
        inputMode="decimal"
        defaultValue={formatInputNumber(initialKg)}
        error={fieldErrors.weightKg}
        selectOnFocus
      />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
