import { z } from "zod";

// `ok` lets a form clear itself after a successful submit that stays on the same page.
export type FormState = { fieldErrors?: Record<string, string>; formError?: string; ok?: true };

export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string[] | undefined> = z.flattenError(error).fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
}

// Russian phone keyboards type "80,5"; an empty field must fail rather than coerce to 0.
export function decimalField(limits: { min: number; max: number }, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed.replace(",", ".");
    },
    z.coerce
      .number({ error: message })
      .min(limits.min, { error: message })
      .max(limits.max, { error: message }),
  );
}

// For optional numbers an empty field means "unknown" (null), never 0.
export function optionalDecimalField(limits: { min: number; max: number }, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    decimalField(limits, message).nullable(),
  );
}

// Whole counts (servings): an empty field means "not set" (null); "4,5" is an error, not 4.
export function optionalIntegerField(limits: { min: number; max: number }, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.coerce
      .number({ error: message })
      .int({ error: message })
      .min(limits.min, { error: message })
      .max(limits.max, { error: message })
      .nullable(),
  );
}
