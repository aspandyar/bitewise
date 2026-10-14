"use client";

import { resetTargetAction, saveManualTargetAction } from "@/app/(app)/actions";
import { useFormStatus } from "react-dom";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { TargetMode } from "@/lib/config";
import { formatGrams, formatKcal } from "@/lib/format";
import { ru } from "@/lib/i18n/ru";
import type { MacroTargets } from "@/lib/nutrition";

const fields = [
  { name: "kcal", label: ru.targets.kcal, format: formatKcal, unit: ru.targets.kcalUnit },
  { name: "proteinG", label: ru.targets.proteinG, format: formatGrams, unit: ru.targets.gramsUnit },
  { name: "fatG", label: ru.targets.fatG, format: formatGrams, unit: ru.targets.gramsUnit },
  { name: "carbsG", label: ru.targets.carbsG, format: formatGrams, unit: ru.targets.gramsUnit },
] as const;

function ResetButton() {
  // Disabled while pending so a double tap cannot fire the reset twice.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 w-full rounded-lg border border-foreground/40 px-4 disabled:opacity-60"
    >
      {ru.targets.resetToAuto}
    </button>
  );
}

export function TargetsForm({
  current,
  calculated,
  mode,
}: {
  current: MacroTargets;
  calculated: MacroTargets;
  mode: TargetMode;
}) {
  const {
    state,
    pending,
    fieldErrors: errors,
    formProps,
  } = usePreservingFormAction(saveManualTargetAction);
  return (
    <div className="flex flex-col gap-4">
      <form {...formProps} className="flex flex-col gap-4">
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
      {/* In auto mode there is nothing to reset to. */}
      {mode === "manual" ? (
        <form action={resetTargetAction}>
          <ResetButton />
        </form>
      ) : null}
    </div>
  );
}
