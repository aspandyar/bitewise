"use client";

import { useFormStatus } from "react-dom";
import { copyFoodAction, deleteFoodAction } from "@/app/(app)/foods/actions";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { KeyedForm } from "@/components/ui/keyed-form";
import { ru } from "@/lib/i18n/ru";

const outlined = "min-h-11 rounded-lg border border-foreground/40 px-4 disabled:opacity-60";

function PendingButton({ children, className }: { children: string; className: string }) {
  // Disabled while pending so a double tap cannot create two copies or fire two deletes.
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {children}
    </button>
  );
}

export function CopyFoodButton({ foodId }: { foodId: string }) {
  return (
    <KeyedForm action={copyFoodAction.bind(null, foodId)}>
      <PendingButton className={`${outlined} w-full`}>{ru.foods.copy}</PendingButton>
    </KeyedForm>
  );
}

export function DeleteFoodButton({ foodId }: { foodId: string }) {
  return <ConfirmDeleteButton action={deleteFoodAction.bind(null, foodId)} />;
}
