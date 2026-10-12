import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";

// Kept free of DB imports so client components can use these types.
export type GramsAmount = { mode: "grams"; grams: number };

export type AddAmount = GramsAmount | { mode: "portion"; portionId: string; count: number };

// Editing keeps the portion snapshot: only its count changes, or the entry switches to grams.
export type UpdateAmount = GramsAmount | { mode: "portion"; count: number };

export type AddEntryInput = { date: IsoDate; meal: Meal; foodId: string; amount: AddAmount };

export type UpdateEntryInput = { meal: Meal; amount: UpdateAmount };

export type DiaryEntry = {
  id: string;
  date: IsoDate;
  meal: Meal;
  foodName: string;
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  grams: number;
  portionLabel: string | null;
  portionGrams: number | null;
  portionCount: number | null;
};
