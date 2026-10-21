import { z } from "zod";
import { REQUEST_ID } from "@/lib/config";

const requestIdSchema = z.uuid();

// No key (a page loaded before this release) or a broken one is not an error: the request still
// runs, it just is not protected from a replay.
export function readRequestId(formData: FormData | undefined): string | null {
  const parsed = requestIdSchema.safeParse(formData?.get(REQUEST_ID.field));
  return parsed.success ? parsed.data : null;
}

// Client side, once per submit: a replay of this request re-sends the same FormData, while the
// next tap builds a new one and gets a new key.
export function stampRequestId(formData: FormData): FormData {
  formData.set(REQUEST_ID.field, crypto.randomUUID());
  return formData;
}
