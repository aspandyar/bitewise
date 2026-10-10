"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addPortionAction, deletePortionAction } from "@/app/(app)/foods/actions";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { formatGrams } from "@/lib/format";
import type { PortionItem } from "@/lib/foods/types";
import { ru } from "@/lib/i18n/ru";

function DeletePortionButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`${ru.foods.deletePortion}: ${label}`}
      className="min-h-11 px-2 text-sm underline disabled:opacity-60"
    >
      {ru.foods.deletePortion}
    </button>
  );
}

export function Portions({ foodId, portions }: { foodId: string; portions: PortionItem[] }) {
  const { state, pending, onSubmit } = usePreservingFormAction(addPortionAction.bind(null, foodId));
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  // Inputs survive errors (usePreservingFormAction) but must clear once a portion is added.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{ru.foods.portionsTitle}</h2>
      {portions.length === 0 ? (
        <p className="text-foreground/60">{ru.foods.noPortions}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {portions.map((portion) => (
            <li key={portion.id} className="flex min-h-11 items-center justify-between gap-2">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {portion.label} — {formatGrams(portion.grams)} {ru.targets.gramsUnit}
              </span>
              {portion.isOwn ? (
                <form action={deletePortionAction.bind(null, foodId, portion.id)}>
                  <DeletePortionButton label={portion.label} />
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField
          label={ru.foods.portionLabel}
          name="label"
          autoComplete="off"
          placeholder={ru.foods.portionLabelPlaceholder}
          error={errors.label}
        />
        <TextField
          label={ru.foods.portionGrams}
          name="grams"
          inputMode="decimal"
          error={errors.grams}
        />
        <FormError message={state.formError} />
        <SubmitButton pending={pending}>{ru.foods.addPortion}</SubmitButton>
      </form>
    </section>
  );
}
