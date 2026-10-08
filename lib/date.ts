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
