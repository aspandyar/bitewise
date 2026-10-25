import { z } from "zod";
import { WATER } from "@/lib/config";

const quickMl: readonly number[] = WATER.quickMl;

// Only the button amounts: anything else came from a tampered form, not from a tap.
const waterMlSchema = z.coerce
  .number()
  .int()
  .refine((ml) => quickMl.includes(ml));

export function parseWaterMl(value: unknown): number | null {
  // z.coerce turns "" and null into 0, which the refine then rejects.
  if (value === undefined) return null;
  const parsed = waterMlSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
