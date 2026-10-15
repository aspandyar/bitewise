// Calendar dates travel as "YYYY-MM-DD" strings: Postgres `date` returns them that way and
// they carry no time zone, so a birthday never shifts by a day.
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC silently rolls over (Feb 30 → Mar 2), so a round-trip catches impossible dates.
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrips ? { year, month, day } : null;
}

// UTC is good enough for "today" here: it only feeds age, where a one-day shift is irrelevant.
export function todayIsoDate(now: Date): IsoDate {
  return now.toISOString().slice(0, 10);
}

// Intl is the only zone-aware calendar in Node; formatToParts avoids relying on a locale's layout.
export function todayInTimeZone(now: Date, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// h23 keeps midnight at 0: the default h24 cycle in some engines reports it as 24.
export function hourInTimeZone(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  const parsed = Number(hour);
  // Never seen in practice; UTC beats NaN, which would silently pick the late meal.
  return Number.isFinite(parsed) ? parsed : now.getUTCHours();
}

// Calendar arithmetic in UTC: no zone means no daylight-saving hour to skip a day over.
export function addDays(date: IsoDate, days: number): IsoDate {
  const parsed = parseIsoDate(date);
  if (!parsed) throw new RangeError(`invalid date: ${date}`);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return shifted.toISOString().slice(0, 10);
}

export function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
