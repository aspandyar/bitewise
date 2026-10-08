"use client";

import { resetTargetAction, saveManualTargetAction } from "@/app/(app)/actions";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import type { MacroTargets } from "@/lib/nutrition";

const fields = [
  { name: "kcal", label: ru.targets.kcal, format: formatKcal, unit: ru.targets.kcalUnit },
  { name: "proteinG", label: ru.targets.proteinG, format: formatGrams, unit: ru.targets.gramsUnit },
  { name: "fatG", label: ru.targets.fatG, format: formatGrams, unit: ru.targets.gramsUnit },
  { name: "carbsG", label: ru.targets.carbsG, format: formatGrams, unit: ru.targets.gramsUnit },
] as const;

export function TargetsForm({
  current,
  calculated,
}: {
  current: MacroTargets;
  calculated: MacroTargets;
}) {
  const { state, pending, onSubmit } = usePreservingFormAction(saveManualTargetAction);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <TextField
              label={field.label}
              name={field.name}
              inputMode="decimal"
              defaultValue={field.format(current[field.name])}
              error={errors[field.name]}
            />
            <p className="text-sm text-foreground/60">
              {ru.targets.calculatedHint}: {field.format(calculated[field.name])} {field.unit}
            </p>
          </div>
        ))}
        <FormError message={state.formError} />
        <SubmitButton pending={pending}>{ru.common.save}</SubmitButton>
      </form>
      <form action={resetTargetAction}>
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg border border-foreground/20 px-4"
        >
          {ru.targets.resetToAuto}
        </button>
      </form>
    </div>
  );
}
