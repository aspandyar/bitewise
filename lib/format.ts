// Rounding lives only here: stored and computed values keep full precision.
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

export function formatGrams(grams: number): string {
  return String(Math.round(grams));
}
