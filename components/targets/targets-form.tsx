"use client";

import { resetTargetAction, saveManualTargetAction } from "@/app/(app)/actions";
import { useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import type { TargetMode } from "@/lib/config";
import { formatGrams, formatKcal } from "@/lib/format";
import { readDecimalInput } from "@/lib/forms";
import { ru } from "@/lib/i18n/ru";
import { calcKcalFromMacros, type MacroTargets } from "@/lib/nutrition";

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
  const [macroKcal, setMacroKcal] = useState<number | null>(() =>
    calcKcalFromMacros({
      proteinG: current.proteinG,
      fatG: current.fatG,
      carbsG: current.carbsG,
      fiberG: null,
    }),
  );

  // Manual kcal and macros are typed separately; the live sum shows when they disagree.
  function onInput(event: FormEvent<HTMLFormElement>) {
    formProps.onInput(event);
    const data = new FormData(event.currentTarget);
    const read = (name: string) => readDecimalInput(String(data.get(name) ?? ""));
    const proteinG = read("proteinG");
    const fatG = read("fatG");
    const carbsG = read("carbsG");
    setMacroKcal(
      proteinG === null || fatG === null || carbsG === null
        ? null
        : calcKcalFromMacros({ proteinG, fatG, carbsG, fiberG: null }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form {...formProps} onInput={onInput} className="flex flex-col gap-4">
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
              {ru.targets.calculatedValue(field.format(calculated[field.name]), field.unit)}
            </p>
            {field.name === "kcal" && macroKcal !== null ? (
              <p className="text-sm text-foreground/60">
                {ru.targets.kcalFromMacros(formatKcal(macroKcal))}
              </p>
            ) : null}
          </div>
        ))}
        <p className="text-sm text-foreground/60">
          {mode === "manual" ? ru.targets.manualKept : ru.targets.manualOnSave}
        </p>
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
