import type { IsoDate } from "@/lib/date";

export const BODY_HREF = "/body";

export function weightHref(date: IsoDate): string {
  return `${BODY_HREF}/${date}`;
}
