import { z } from "zod";
import { WATER } from "@/lib/config";

const quickMl: readonly number[] = WATER.quickMl;

// Only the button amounts: anything else came from a tampered form, not from a tap.
const waterMlSchema = z.coerce
  .number()
  .int()
  .refine((ml) => quickMl.includes(ml));

// z.coerce turns "" and null into 0 and undefined into NaN; the refine rejects all of them.
export function parseWaterMl(value: unknown): number | null {
  const parsed = waterMlSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function calcWaterShare(totalMl: number, targetMl: number): number {
  // The bar stops at full: more water than the target is not "over" like kcal are.
  return targetMl > 0 ? Math.min(totalMl / targetMl, 1) : 0;
}
