import { MIFFLIN_ST_JEOR, type Sex } from "@/lib/config";

export type BmrInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  // Age is passed in rather than derived from a birth date so the function stays pure.
  ageYears: number;
};

// Forms validate realistic ranges with zod; this guard only stops nonsense from
// silently producing a plausible-looking number if a caller skips validation.
function assertBmrInput({ weightKg, heightCm, ageYears }: BmrInput): void {
  if (!(Number.isFinite(weightKg) && weightKg > 0)) {
    throw new RangeError(`weightKg must be a positive number, got ${weightKg}`);
  }
  if (!(Number.isFinite(heightCm) && heightCm > 0)) {
    throw new RangeError(`heightCm must be a positive number, got ${heightCm}`);
  }
  if (!(Number.isFinite(ageYears) && ageYears >= 0)) {
    throw new RangeError(`ageYears must be a non-negative number, got ${ageYears}`);
  }
}

export function calcBmrKcal(input: BmrInput): number {
  assertBmrInput(input);
  const { sex, weightKg, heightCm, ageYears } = input;
  return (
    MIFFLIN_ST_JEOR.kcalPerKg * weightKg +
    MIFFLIN_ST_JEOR.kcalPerCm * heightCm -
    MIFFLIN_ST_JEOR.kcalPerYear * ageYears +
    MIFFLIN_ST_JEOR.sexConstantKcal[sex]
  );
}
