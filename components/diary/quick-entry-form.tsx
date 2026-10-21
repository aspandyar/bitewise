"use client";

import { useState, type FocusEvent, type FormEvent } from "react";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import type { QuickEntryValues } from "@/lib/diary/quick-entry";
import { quickKcalMismatchEstimate } from "@/lib/foods/kcal-check";
import { formatInputNumber, formatKcal } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { MealPicker } from "./meal-picker";

const macroFields = [
  { name: "proteinG", label: ru.diary.quickProtein },
  { name: "fatG", label: ru.diary.quickFat },
  { name: "carbsG", label: ru.diary.quickCarbs },
] as const;

// A saved 0 is an empty field: macros were optional and nobody typed them.
function macroText(value: number): string {
  return value > 0 ? formatInputNumber(value) : "";
}

function estimateFrom(form: HTMLFormElement): number | null {
  const data = new FormData(form);
  const read = (name: string) => String(data.get(name) ?? "");
  return quickKcalMismatchEstimate({
    kcal: read("kcal"),
    proteinG: read("proteinG"),
    fatG: read("fatG"),
    carbsG: read("carbsG"),
  });
}

// "Just kcal": only kcal are required; an empty macro counts as 0.
export function QuickEntryForm({
  action,
  date,
  meal,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  // Only for a new entry: an edit keeps the entry's day.
  date?: IsoDate;
  meal: Meal;
  initial?: QuickEntryValues;
  submitLabel: string;
}) {
  const { state, pending, fieldErrors: errors, formProps } = usePreservingFormAction(action);
  const [kcalEstimate, setKcalEstimate] = useState(() =>
    initial
      ? quickKcalMismatchEstimate({
          kcal: formatInputNumber(initial.kcal),
          proteinG: macroText(initial.proteinG),
          fatG: macroText(initial.fatG),
          carbsG: macroText(initial.carbsG),
        })
      : null,
  );

  // As in the food form: only a warning, shown when a field is left and gone once it no longer
  // applies, so it never jumps in while a number is being typed.
  function onInput(event: FormEvent<HTMLFormElement>) {
    formProps.onInput(event);
    if (kcalEstimate !== null && estimateFrom(event.currentTarget) === null) setKcalEstimate(null);
  }

  function onBlur(event: FocusEvent<HTMLFormElement>) {
    setKcalEstimate(estimateFrom(event.currentTarget));
  }

  return (
    <form {...formProps} onInput={onInput} onBlur={onBlur} className="flex flex-col gap-4">
      {date ? <input type="hidden" name="date" value={date} /> : null}
      <TextField
        label={ru.diary.quickKcal}
        name="kcal"
        inputMode="decimal"
        autoFocus={!initial}
        selectOnFocus
        defaultValue={formatInputNumber(initial?.kcal)}
        error={errors.kcal}
      />
      <TextField
        label={ru.diary.quickName}
        name="name"
        autoComplete="off"
        placeholder={ru.diary.quickDefaultName}
        defaultValue={initial && initial.name !== ru.diary.quickDefaultName ? initial.name : ""}
        error={errors.name}
      />
      <p className="text-sm text-foreground/60">{ru.diary.quickMacrosHint}</p>
      <div className="grid grid-cols-3 gap-2">
        {macroFields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            name={field.name}
            inputMode="decimal"
            defaultValue={initial ? macroText(initial[field.name]) : ""}
            error={errors[field.name]}
          />
        ))}
      </div>
      {/* Always mounted, so a screen reader announces the warning when its text appears. */}
      <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
        {kcalEstimate === null ? null : ru.foods.kcalMismatch(formatKcal(kcalEstimate))}
      </p>
      <MealPicker defaultValue={meal} error={errors.meal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
