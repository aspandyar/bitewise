import { NUTRIENT_STORAGE_DECIMALS, WEIGHT } from "@/lib/config";
import { addDays, parseIsoDate, type IsoDate } from "@/lib/date";
import { formatNumber } from "@/lib/i18n/number";
import { ru } from "@/lib/i18n/ru";

// Rounding lives only here: stored and computed values keep full precision.
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal));
}

export function formatGrams(grams: number): string {
  return String(Math.round(grams));
}

// A lower bound shown in a message: rounding down would name a weight the check still rejects.
export function formatGramsAtLeast(grams: number): string {
  return formatNumber(Math.ceil(grams));
}

// Decided on the shown number, not the raw one: −0.3 kcal left must not read "over by 0".
// formatKcal and formatGrams round the same way, so this serves both.
export function isOverTarget(remaining: number): boolean {
  return Math.round(remaining) < 0;
}

const amountFormat = new Intl.NumberFormat(ru.locale, {
  maximumFractionDigits: NUTRIENT_STORAGE_DECIMALS,
  useGrouping: false,
});

// Prefills an edit form with the stored value as typed — full precision, a decimal comma, no
// thousand groups — so saving without changes keeps it exact.
export function formatInputNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

const weightFormat = new Intl.NumberFormat(ru.locale, {
  minimumFractionDigits: WEIGHT.decimals,
  maximumFractionDigits: WEIGHT.decimals,
  useGrouping: false,
});

// Always one decimal, so a column of weights lines up and 78 reads as a weigh-in, "78,0".
export function formatWeightKg(kg: number): string {
  return weightFormat.format(kg);
}

// Portion counts are stored to hundredths, so that is all the precision worth showing.
export function formatAmount(count: number): string {
  return amountFormat.format(count);
}

// Chart axis labels: "25 окт", no weekday, to fit under a narrow chart.
export function formatShortDate(date: IsoDate): string {
  const parsed = parseIsoDate(date);
  const month = parsed ? ru.diary.monthsShort[parsed.month - 1] : undefined;
  if (!parsed || month === undefined) throw new RangeError(`invalid date: ${date}`);
  return `${parsed.day}\u00a0${month}`;
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
  // Null marks a "just kcal" entry: its 100 g are bookkeeping, not food weighed.
  foodId?: string | null;
}): string {
  if (entry.foodId === null) return "";
  const grams = formatGrams(entry.grams);
  if (entry.portionLabel === null || entry.portionCount === null) {
    return ru.diary.amountGrams(grams);
  }
  return entry.portionCount === 1
    ? ru.diary.amountPortion(entry.portionLabel, grams)
    : ru.diary.amountPortions(formatAmount(entry.portionCount), entry.portionLabel, grams);
}
