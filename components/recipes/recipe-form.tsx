"use client";

import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import type { RecipeValues } from "@/lib/recipes/types";

// Edit shows stored values as typed, so saving without changes keeps them exact.
function asInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function RecipeForm({
  action,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: RecipeValues;
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <TextField
        label={ru.recipes.name}
        name="name"
        autoComplete="off"
        autoFocus={!initial}
        placeholder={ru.recipes.namePlaceholder}
        defaultValue={initial?.name}
        error={errors.name}
      />
      <div className="flex flex-col gap-1">
        <TextField
          label={ru.recipes.cookedWeight}
          name="cookedWeightG"
          inputMode="decimal"
          defaultValue={asInput(initial?.cookedWeightG)}
          error={errors.cookedWeightG}
        />
        {/* The error already says what to fix; the hint under it would read as a second message. */}
        {errors.cookedWeightG ? null : (
          <p className="text-sm text-foreground/60">{ru.recipes.cookedWeightHint}</p>
        )}
      </div>
      <TextField
        label={ru.recipes.servings}
        name="servings"
        inputMode="numeric"
        defaultValue={asInput(initial?.servings)}
        error={errors.servings}
      />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
