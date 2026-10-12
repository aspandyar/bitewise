"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ru } from "@/lib/i18n/ru";

const outlined = "min-h-11 rounded-lg border border-foreground/40 px-4 disabled:opacity-60";

function ConfirmButton() {
  // Disabled while pending so a double tap cannot fire two deletes.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg bg-red-600 px-4 font-medium text-white disabled:opacity-60"
    >
      {ru.common.confirmDelete}
    </button>
  );
}

// Two steps instead of window.confirm: the native dialog looks out of place in an installed PWA.
export function ConfirmDeleteButton({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  // A hidden screen (cacheComponents) keeps its state; disarm on leaving so every visit takes
  // two taps again.
  useEffect(() => () => setConfirming(false), []);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={outlined}>
        {ru.common.delete}
      </button>
    );
  }
  return (
    <form action={action} className="flex gap-2">
      <ConfirmButton />
      <button type="button" onClick={() => setConfirming(false)} className={outlined}>
        {ru.common.cancel}
      </button>
    </form>
  );
}
