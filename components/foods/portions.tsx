"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addPortionAction, deletePortionAction } from "@/app/(app)/foods/actions";
import { FormError, SubmitButton, TextField, usePreservingFormAction } from "@/components/ui/form";
import { formatGrams, formatKcal } from "@/lib/format";
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

// kcal per portion arrives computed by the server page; the client does not derive nutrients.
export function Portions({
  foodId,
  portions,
}: {
  foodId: string;
  portions: (PortionItem & { kcal: number })[];
}) {
  const {
    state,
    pending,
    fieldErrors: errors,
    formProps,
  } = usePreservingFormAction(addPortionAction.bind(null, foodId));
  const formRef = useRef<HTMLFormElement>(null);

  // Inputs survive errors (usePreservingFormAction) but must clear once a portion is added, and
  // the label takes focus again: portions are usually added several in a row.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    const label = formRef.current?.elements.namedItem("label");
    if (label instanceof HTMLInputElement) label.focus();
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
                {ru.foods.portionRow(
                  portion.label,
                  formatGrams(portion.grams),
                  formatKcal(portion.kcal),
                )}
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
      <form ref={formRef} {...formProps} className="flex flex-col gap-3">
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
