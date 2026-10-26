import { z } from "zod";
import { ru } from "@/lib/i18n/ru";

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

// Russian phone keyboards type "80,5"; an empty field must fail rather than coerce to 0, and
// it gets its own message: "enter grams" says more than a range when nothing was typed. Letters
// get "enter a number" too: a range would suggest the value was a number, only too big (#123).
export function decimalField(
  limits: { min: number; max: number },
  message: string,
  emptyMessage: string,
) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : Number(trimmed.replace(",", "."));
    },
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? emptyMessage
            : Number.isNaN(issue.input)
              ? ru.common.notANumber
              : message,
      })
      .min(limits.min, { error: message })
      .max(limits.max, { error: message }),
  );
}

// For optional numbers an empty field means "unknown" (null), never 0, so it is never "empty".
export function optionalDecimalField(limits: { min: number; max: number }, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    decimalField(limits, message, message).nullable(),
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

// An error describes what was submitted; once the user changes that field it no longer applies,
// and keeping it red while they fix it reads as if the fix were wrong too.
export function visibleFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  editedSinceSubmit: ReadonlySet<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors ?? {}).filter(([field]) => !editedSinceSubmit.has(field)),
  );
}

// For live previews while typing: the same reading as decimalField ("12,6" from a Russian
// keyboard), with null for anything that is not a number yet.
export function readDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
