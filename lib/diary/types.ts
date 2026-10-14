import type { AddAmount, UpdateAmount } from "@/lib/amount";
import type { Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";

// Kept free of DB imports so client components can use these types.
export type AddEntryInput = { date: IsoDate; meal: Meal; foodId: string; amount: AddAmount };

export type UpdateEntryInput = { meal: Meal; amount: UpdateAmount };

export type DiaryEntry = {
  id: string;
  date: IsoDate;
  meal: Meal;
  // Lets an entry saved in grams pick one of its food's portions when edited.
  foodId: string;
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
