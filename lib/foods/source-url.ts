import { OFF, USDA_FDC_URL, type FoodSource } from "@/lib/config";

// The column has a CHECK, but the page renders the value as an href: a second gate here means a
// row written around the seed (manual SQL, a future import) still cannot become a script link.
export function safeSourceUrl(url: string | null): string | null {
  if (!url || !URL.canParse(url)) return null;
  return new URL(url).protocol === "https:" ? url : null;
}

// A copy keeps no source_url of its own, so its credit links to where the data came from: the
// product page when the copy kept the pack's barcode, otherwise the source's site (#114).
export function copySourceUrl(copiedFrom: FoodSource, barcode: string | null): string | null {
  switch (copiedFrom) {
    case "off":
      return barcode ? `${OFF.productPageUrl}${barcode}` : OFF.siteUrl;
    case "usda":
      return USDA_FDC_URL;
    default:
      return null;
  }
}
