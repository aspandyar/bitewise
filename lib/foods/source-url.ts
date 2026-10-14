// The column has a CHECK, but the page renders the value as an href: a second gate here means a
// row written around the seed (manual SQL, a future import) still cannot become a script link.
export function safeSourceUrl(url: string | null): string | null {
  if (!url || !URL.canParse(url)) return null;
  return new URL(url).protocol === "https:" ? url : null;
}
