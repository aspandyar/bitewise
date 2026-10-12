import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE } from "@/lib/config";
import { todayInTimeZone, type IsoDate } from "@/lib/date";
import { resolveTimeZone } from "./time-zone";

// Reads cookies, so it is request-time: pages call it inside their <Suspense> boundary.
export async function getUserToday(now: Date): Promise<IsoDate> {
  const cookieStore = await cookies();
  return todayInTimeZone(now, resolveTimeZone(cookieStore.get(TIME_ZONE_COOKIE.name)?.value));
}
