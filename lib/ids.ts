import { z } from "zod";

const idSchema = z.uuid();

// Postgres throws on a malformed uuid, so ids from URLs and bound arguments are checked first.
export function parseId(value: unknown): string | null {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
