"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Disabled while the add runs, so a double tap cannot log the food twice.
export function QuickAddButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full min-w-0 flex-col items-start py-2 text-left disabled:opacity-60"
    >
      {children}
    </button>
  );
}
