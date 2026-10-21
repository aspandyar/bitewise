import { z } from "zod";
import { REQUEST_ID } from "@/lib/config";

const requestIdSchema = z.uuid();

// Client-side module state: set by RequestUser in the root layout for the session the page
// was rendered with. A replay re-sends the FormData stamped at submit, so it keeps this value
// even if the cookie now belongs to someone else.
let requestUser: string | null = null;

export function setRequestUser(userId: string | null): void {
  requestUser = userId;
}

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
  if (requestUser !== null) formData.set(REQUEST_ID.userField, requestUser);
  return formData;
}

// A form without the field (no JS, a page from before this release, sign-up) is not foreign:
// only a stamped user that differs from the session is.
export function isForeignRequest(formData: FormData | undefined, userId: string): boolean {
  if (!(formData instanceof FormData)) return false;
  const stamped = formData.get(REQUEST_ID.userField);
  return stamped !== null && stamped !== userId;
}
