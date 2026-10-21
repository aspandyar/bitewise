"use client";

import type { ReactNode } from "react";
import { stampRequestId } from "@/lib/request-id";

// A one-button form whose action creates something: each tap gets its own request key, so a
// replay of the same request (lost response, #95) does not create it twice.
export function KeyedForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={(formData) => action(stampRequestId(formData))} className={className}>
      {children}
    </form>
  );
}
