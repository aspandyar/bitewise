"use client";

import { useState, type FormEvent } from "react";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { kcalMismatchEstimate } from "@/lib/foods/kcal-check";
import { formatKcal } from "@/lib/format";
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
  draftName,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: FoodValues;
  // A new food started from an empty search opens with the query as its name.
  draftName?: string;
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  const [kcalEstimate, setKcalEstimate] = useState(() =>
    kcalMismatchEstimate({
      kcal100: asInput(initial?.kcal100),
      protein100: asInput(initial?.protein100),
      fat100: asInput(initial?.fat100),
      carbs100: asInput(initial?.carbs100),
      fiber100: asInput(initial?.fiber100),
    }),
  );

  // Re-checked on every keystroke; it only warns, saving stays possible (alcohol, rounded labels).
  function onInput(event: FormEvent<HTMLFormElement>) {
    formProps.onInput(event);
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "");
    setKcalEstimate(
      kcalMismatchEstimate({
        kcal100: read("kcal100"),
        protein100: read("protein100"),
        fat100: read("fat100"),
        carbs100: read("carbs100"),
        fiber100: read("fiber100"),
      }),
    );
  }

  return (
    <form {...formProps} onInput={onInput} className="flex flex-col gap-4">
      <TextField
        label={ru.foods.name}
        name="name"
        autoComplete="off"
        defaultValue={initial?.name ?? draftName}
        error={errors.name}
      />
      <p className="text-sm text-foreground/60">{ru.foods.valuesHint}</p>
      {numberFields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <TextField
            label={field.label}
            name={field.name}
            inputMode="decimal"
            defaultValue={asInput(initial?.[field.name])}
            // With the name already taken from the search, the first thing to type is kcal.
            autoFocus={draftName !== undefined && field.name === "kcal100"}
            error={errors[field.name]}
          />
          {/* Always mounted (empty takes no space), so a screen reader announces the warning
              when its text appears. */}
          {field.name === "kcal100" ? (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
              {kcalEstimate === null ? null : ru.foods.kcalMismatch(formatKcal(kcalEstimate))}
            </p>
          ) : null}
        </div>
      ))}
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
    </form>
  );
}
