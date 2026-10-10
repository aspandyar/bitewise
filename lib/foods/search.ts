import { FOOD_SEARCH } from "@/lib/config";

// Mirrors foods.search_name (lower + ё→е) so the query and the column compare like for like.
export function normalizeFoodQuery(raw: string | null): string | null {
  if (raw === null) return null;
  const normalized = raw.trim().replace(/\s+/g, " ").toLowerCase().replaceAll("ё", "е");
  if (normalized.length === 0 || normalized.length > FOOD_SEARCH.maxQueryLength) return null;
  return normalized;
}

// Backslash is Postgres' default LIKE escape; without this "%" would match every food.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
