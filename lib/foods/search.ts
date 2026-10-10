import { z } from "zod";
import { FOOD_SEARCH } from "@/lib/config";

// Mirrors foods.search_name (lower + ё→е) so the query and the column compare like for like.
export const foodQuerySchema = z
  .string()
  .transform((raw) => raw.trim().replace(/\s+/g, " ").toLowerCase().replaceAll("ё", "е"))
  .pipe(z.string().min(1).max(FOOD_SEARCH.maxQueryLength));

export function normalizeFoodQuery(raw: string | null): string | null {
  const parsed = foodQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// Backslash is Postgres' default LIKE escape; without this "%" would match every food.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
