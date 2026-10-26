"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { stampRequestId } from "@/lib/request-id";

// Disabled while any button of the form runs, so a double tap cannot pour two glasses or remove
// two. A keyed button creates something: each tap gets its own request key (#95).
export function WaterButton({
  action,
  keyed = false,
  primary = false,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  keyed?: boolean;
  primary?: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={keyed ? (formData) => action(stampRequestId(formData)) : action}
      disabled={pending}
      className={`min-h-11 w-full rounded-lg px-4 font-medium disabled:opacity-60 ${
        primary ? "bg-accent text-on-accent" : "border border-foreground/20 text-sm"
      }`}
    >
      {children}
    </button>
  );
}
