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
// Returns the Atwater estimate (4/9/4, fiber 2) to show when the typed kcal look like a typo.
export function kcalMismatchEstimate(values: FoodFormNumbers): number | null {
  const kcal = readDecimalInput(values.kcal100);
  const proteinG = readDecimalInput(values.protein100);
  const fatG = readDecimalInput(values.fat100);
  const carbsG = readDecimalInput(values.carbs100);
  if (kcal === null || proteinG === null || fatG === null || carbsG === null) return null;
  const macros = { proteinG, fatG, carbsG, fiberG: readDecimalInput(values.fiber100) };
  return isKcalConsistentWithMacros(kcal, macros) ? null : calcKcalFromMacros(macros);
}

type QuickEntryNumbers = { kcal: string; proteinG: string; fatG: string; carbsG: string };

// "Just kcal" (#89): macros are optional and an empty one counts as 0, so the hint waits for at
// least one typed macro; 50 kcal with 100 g of protein would otherwise skew the day silently.
export function quickKcalMismatchEstimate(values: QuickEntryNumbers): number | null {
  const kcal = readDecimalInput(values.kcal);
  const typed = [values.proteinG, values.fatG, values.carbsG].map((value) => value.trim());
  if (kcal === null || typed.every((value) => value === "")) return null;
  const [proteinG, fatG, carbsG] = typed.map((value) =>
    value === "" ? 0 : readDecimalInput(value),
  );
  if (proteinG == null || fatG == null || carbsG == null) return null;
  const macros = { proteinG, fatG, carbsG, fiberG: null };
  return isKcalConsistentWithMacros(kcal, macros) ? null : calcKcalFromMacros(macros);
}
