import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE } from "@/lib/config";
import { todayInTimeZone, type IsoDate } from "@/lib/date";
import { resolveTimeZone } from "./time-zone";

// Reads cookies, so it is request-time: pages call it inside their <Suspense> boundary.
export async function getUserTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  return resolveTimeZone(cookieStore.get(TIME_ZONE_COOKIE.name)?.value);
}

export async function getUserToday(now: Date): Promise<IsoDate> {
  return todayInTimeZone(now, await getUserTimeZone());
}
