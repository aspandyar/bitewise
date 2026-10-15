"use client";

import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import type { QuickEntryValues } from "@/lib/diary/quick-entry";
import { formatInputNumber } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { MealPicker } from "./meal-picker";

const macroFields = [
  { name: "proteinG", label: ru.diary.quickProtein },
  { name: "fatG", label: ru.diary.quickFat },
  { name: "carbsG", label: ru.diary.quickCarbs },
] as const;

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
  return (
    <form {...formProps} className="flex flex-col gap-4">
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
      <div className="grid grid-cols-3 gap-2">
        {macroFields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            name={field.name}
            inputMode="decimal"
            defaultValue={
              initial && initial[field.name] > 0 ? formatInputNumber(initial[field.name]) : ""
            }
            error={errors[field.name]}
          />
        ))}
      </div>
      <MealPicker defaultValue={meal} error={errors.meal} />
      <FormError message={state.formError} />
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
