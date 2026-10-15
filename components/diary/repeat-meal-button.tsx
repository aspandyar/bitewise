"use client";

import { useFormStatus } from "react-dom";

// Disabled while the repeat runs, so a double tap cannot copy the meal twice.
export function RepeatMealButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full items-center rounded-lg border border-foreground/20 px-4 py-2 text-left text-sm [overflow-wrap:anywhere] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
