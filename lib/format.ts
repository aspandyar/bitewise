import { NUTRIENT_STORAGE_DECIMALS } from "@/lib/config";
import { addDays, parseIsoDate, type IsoDate } from "@/lib/date";
import { ru } from "@/lib/i18n/ru";

// Rounding lives only here: stored and computed values keep full precision.
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

export function formatGrams(grams: number): string {
  return String(Math.round(grams));
}

const amountFormat = new Intl.NumberFormat(ru.locale, {
  maximumFractionDigits: NUTRIENT_STORAGE_DECIMALS,
  useGrouping: false,
});

// Portion counts are stored to hundredths, so that is all the precision worth showing.
export function formatAmount(count: number): string {
  return amountFormat.format(count);
}

export function formatDayLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return ru.diary.today;
  if (date === addDays(today, -1)) return ru.diary.yesterday;
  const parsed = parseIsoDate(date);
  if (!parsed) throw new RangeError(`invalid date: ${date}`);
  const weekdayIndex = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  const month = ru.diary.monthsShort[parsed.month - 1];
  const weekday = ru.diary.weekdaysShort[weekdayIndex];
  if (month === undefined || weekday === undefined) {
    throw new RangeError(`invalid date: ${date}`);
  }
  const sameYear = parseIsoDate(today)?.year === parsed.year;
  return ru.diary.dayLabel(parsed.day, month, weekday, sameYear ? undefined : parsed.year);
}

export function formatEntryAmount(entry: {
  grams: number;
  portionLabel: string | null;
  portionCount: number | null;
}): string {
  const grams = formatGrams(entry.grams);
  if (entry.portionLabel === null || entry.portionCount === null) {
    return ru.diary.amountGrams(grams);
  }
  return entry.portionCount === 1
    ? ru.diary.amountPortion(entry.portionLabel, grams)
    : ru.diary.amountPortions(formatAmount(entry.portionCount), entry.portionLabel, grams);
}
