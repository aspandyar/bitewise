import { z } from "zod";
import { FOOD_SEARCH } from "@/lib/config";

const querySchema = z.string().trim().min(1).max(FOOD_SEARCH.maxQueryLength);

// From the URL, so it only prefills the search field: anything odd starts an empty search.
export function parseSearchQuery(value: unknown): string | undefined {
  const parsed = querySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

// "Back" from a new food started from a search returns to that search with its query (#92).
export function withSearchQuery(href: string, query: string | undefined): string {
  if (query === undefined) return href;
  const [path = "", search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set(FOOD_SEARCH.queryParam, query);
  return `${path}?${params}`;
}
