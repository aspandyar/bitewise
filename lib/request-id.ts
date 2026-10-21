import { z } from "zod";
import { REQUEST_ID } from "@/lib/config";

const requestIdSchema = z.uuid();

// Set by RequestUserMark for the session the page was rendered with; not httpOnly, since the
// browser stamps it into forms. It is the viewer's own id and grants nothing on its own.
export function requestUserCookie(userId: string | null, { https }: { https: boolean }): string {
  const secure = https ? "; secure" : "";
  return userId
    ? `${REQUEST_ID.userCookie}=${userId}; path=/; samesite=lax${secure}`
    : `${REQUEST_ID.userCookie}=; path=/; max-age=0; samesite=lax${secure}`;
}

function currentRequestUser(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${REQUEST_ID.userCookie}=`;
  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  return value || null;
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
  // Read at submit, not at render: a replay re-sends this FormData with the user it was sent as.
  const user = currentRequestUser();
  if (user !== null) formData.set(REQUEST_ID.userField, user);
  return formData;
}

// A form without the field (no JS, a page from before this release, sign-up) is not foreign:
// only a stamped user that differs from the session is.
export function isForeignRequest(formData: FormData | undefined, userId: string): boolean {
  if (!(formData instanceof FormData)) return false;
  const stamped = formData.get(REQUEST_ID.userField);
  return stamped !== null && stamped !== userId;
}
