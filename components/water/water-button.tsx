"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Disabled while the action runs, so a double tap cannot pour two glasses or remove two.
export function WaterButton({
  primary = false,
  children,
}: {
  primary?: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 w-full rounded-lg px-4 font-medium disabled:opacity-60 ${
        primary ? "bg-accent text-on-accent" : "border border-foreground/20 text-sm"
      }`}
    >
      {children}
    </button>
  );
}
