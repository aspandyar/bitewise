"use client";

import { useState, type FocusEvent, type FormEvent } from "react";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { kcalMismatchEstimate } from "@/lib/foods/kcal-check";
import { formatInputNumber, formatKcal } from "@/lib/format";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
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

export function FoodForm({
  action,
  initial,
  draftName,
  entry,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: FoodValues;
  // A new food started from an empty search opens with the query as its name.
  draftName?: string;
  // Started from the diary search: saving returns to the amount screen of that day and meal.
  entry?: { date: IsoDate; meal: Meal };
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  const [kcalEstimate, setKcalEstimate] = useState(() =>
    kcalMismatchEstimate({
      kcal100: formatInputNumber(initial?.kcal100),
      protein100: formatInputNumber(initial?.protein100),
      fat100: formatInputNumber(initial?.fat100),
      carbs100: formatInputNumber(initial?.carbs100),
      fiber100: formatInputNumber(initial?.fiber100),
    }),
  );

  function estimateFrom(form: HTMLFormElement): number | null {
    const data = new FormData(form);
    const read = (name: string) => String(data.get(name) ?? "");
    return kcalMismatchEstimate({
      kcal100: read("kcal100"),
      protein100: read("protein100"),
      fat100: read("fat100"),
      carbs100: read("carbs100"),
      fiber100: read("fiber100"),
    });
  }

  // Only a warning: saving stays possible (alcohol, rounded labels). It appears when a field is
  // left, so it never pushes the field being typed in mid-number, and goes as soon as it no
  // longer applies.
  function onInput(event: FormEvent<HTMLFormElement>) {
    formProps.onInput(event);
    if (kcalEstimate !== null && estimateFrom(event.currentTarget) === null) setKcalEstimate(null);
  }

  function onBlur(event: FocusEvent<HTMLFormElement>) {
    setKcalEstimate(estimateFrom(event.currentTarget));
  }

  return (
    <form {...formProps} onInput={onInput} onBlur={onBlur} className="flex flex-col gap-4">
      {entry ? (
        <>
          <input type="hidden" name="date" value={entry.date} />
          <input type="hidden" name="meal" value={entry.meal} />
        </>
      ) : null}
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
            defaultValue={formatInputNumber(initial?.[field.name])}
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
