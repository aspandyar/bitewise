import { MIFFLIN_ST_JEOR, type Sex } from "@/lib/config";

export type BmrInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  // Age is passed in rather than derived from a birth date so the function stays pure.
  ageYears: number;
};

export function calcBmrKcal({ sex, weightKg, heightCm, ageYears }: BmrInput): number {
  return (
    MIFFLIN_ST_JEOR.kcalPerKg * weightKg +
    MIFFLIN_ST_JEOR.kcalPerCm * heightCm -
    MIFFLIN_ST_JEOR.kcalPerYear * ageYears +
    MIFFLIN_ST_JEOR.sexConstantKcal[sex]
  );
}
