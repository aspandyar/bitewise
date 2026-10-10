"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { copyFoodAction, deleteFoodAction } from "@/app/(app)/foods/actions";
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
    <form action={copyFoodAction.bind(null, foodId)}>
      <PendingButton className={`${outlined} w-full`}>{ru.foods.copy}</PendingButton>
    </form>
  );
}

// Two steps instead of window.confirm: the native dialog looks out of place in an installed PWA.
export function DeleteFoodButton({ foodId }: { foodId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={outlined}>
        {ru.foods.delete}
      </button>
    );
  }
  return (
    <form action={deleteFoodAction.bind(null, foodId)} className="flex gap-2">
      <PendingButton className="min-h-11 rounded-lg bg-red-600 px-4 font-medium text-white disabled:opacity-60">
        {ru.foods.confirmDelete}
      </PendingButton>
      <button type="button" onClick={() => setConfirming(false)} className={outlined}>
        {ru.foods.cancel}
      </button>
    </form>
  );
}
