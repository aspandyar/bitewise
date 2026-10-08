import { z } from "zod";

export type FormState = { fieldErrors?: Record<string, string>; formError?: string };

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
