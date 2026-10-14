import { NUTRIENT_STORAGE_DECIMALS } from "@/lib/config";

// Lives apart from the dictionary and lib/format: both use it, and lib/format imports the dictionary.
export const LOCALE = "ru-RU";

// Limits and counts in messages read like numbers in the interface: "0,1", "20 000". Russian
// typography groups thousands from five digits up, so "5000" stays whole.
const numberFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: NUTRIENT_STORAGE_DECIMALS,
  useGrouping: "min2",
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
