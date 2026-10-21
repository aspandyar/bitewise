import { z } from "zod";
import { REQUEST_ID } from "@/lib/config";

const requestIdSchema = z.uuid();

// No key (a page loaded before this release) or a broken one is not an error: the request still
// runs, it just is not protected from a replay.
export function readRequestId(formData: FormData | undefined): string | null {
  // Actions can be called with any arguments, not only from our forms.
  const raw = formData instanceof FormData ? formData.get(REQUEST_ID.field) : undefined;
  const parsed = requestIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// Client side, once per submit: a replay of this request re-sends the same FormData, while the
// next tap builds a new one and gets a new key.
export function stampRequestId(formData: FormData): FormData {
  // randomUUID exists only in secure contexts; over plain http (a phone on the dev server's LAN
  // address) the form still goes, just without replay protection.
  if (typeof crypto.randomUUID === "function") formData.set(REQUEST_ID.field, crypto.randomUUID());
  return formData;
}
