import { readDecimalInput } from "@/lib/forms";
import { calcKcalFromMacros, isKcalConsistentWithMacros } from "@/lib/nutrition";

type FoodFormNumbers = {
  kcal100: string;
  protein100: string;
  fat100: string;
  carbs100: string;
  fiber100: string;
};

// Runs while the form is typed in, so it stays silent until every number it needs is there.
// Returns the 4/9/4 estimate to show when the typed kcal look like a typo.
export function kcalMismatchEstimate(values: FoodFormNumbers): number | null {
  const kcal = readDecimalInput(values.kcal100);
  const proteinG = readDecimalInput(values.protein100);
  const fatG = readDecimalInput(values.fat100);
  const carbsG = readDecimalInput(values.carbs100);
  if (kcal === null || proteinG === null || fatG === null || carbsG === null) return null;
  const macros = { proteinG, fatG, carbsG, fiberG: readDecimalInput(values.fiber100) };
  return isKcalConsistentWithMacros(kcal, macros) ? null : calcKcalFromMacros(macros);
}
