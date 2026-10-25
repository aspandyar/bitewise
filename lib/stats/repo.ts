import { and, eq, gte, lte } from "drizzle-orm";
import { diaryEntries } from "@/db/schema";
import type { Db } from "@/db/types";
import type { IsoDate } from "@/lib/date";
import type { DayEntryValues } from "@/lib/nutrition";

// Raw snapshots, not sums: day totals are computed by lib/nutrition, never in SQL. A month is a
// few hundred rows, which the (user_id, date) index serves directly.
export async function getPeriodEntries(
  db: Db,
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<DayEntryValues[]> {
  return db
    .select({
      date: diaryEntries.date,
      grams: diaryEntries.grams,
      kcal100: diaryEntries.kcal100,
      protein100: diaryEntries.protein100,
      fat100: diaryEntries.fat100,
      carbs100: diaryEntries.carbs100,
    })
    .from(diaryEntries)
    .where(
      and(
        eq(diaryEntries.userId, userId),
        gte(diaryEntries.date, from),
        lte(diaryEntries.date, to),
      ),
    );
}
