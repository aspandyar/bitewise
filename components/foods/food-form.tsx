"use client";

import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";
import type { FoodValues } from "@/lib/foods/types";
import { ru } from "@/lib/i18n/ru";

const numberFields = [
  { name: "kcal100", label: ru.foods.kcal100 },
  { name: "protein100", label: ru.foods.protein100 },
  { name: "fat100", label: ru.foods.fat100 },
  { name: "carbs100", label: ru.foods.carbs100 },
  { name: "fiber100", label: ru.foods.fiber100 },
] as const;

// Edit shows stored values as typed (no rounding), so saving without changes keeps them exact.
function asInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function FoodForm({
  action,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: FoodValues;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction(action);
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label={ru.foods.name}
        name="name"
        autoComplete="off"
        defaultValue={initial?.name}
        error={errors.name}
      />
      <p className="text-sm text-foreground/60">{ru.foods.valuesHint}</p>
      {numberFields.map((field) => (
        <TextField
          key={field.name}
          label={field.label}
          name={field.name}
          inputMode="decimal"
          defaultValue={asInput(initial?.[field.name])}
          error={errors[field.name]}
        />
      ))}
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
