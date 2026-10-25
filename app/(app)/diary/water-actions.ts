"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireActionUser, requireWriteUser } from "@/lib/auth/session";
import { dayHref } from "@/lib/diary/paths";
import { parseDiaryDate, parseId } from "@/lib/diary/schema";
import { getUserToday } from "@/lib/diary/today";
import { readRequestId } from "@/lib/request-id";
import { withToast } from "@/lib/toast";
import { addWater, removeWater } from "@/lib/water/repo";
import { parseWaterMl } from "@/lib/water/schema";

// Date and amount are bound arguments from the page; both are re-validated here.
export async function addWaterAction(
  rawDate: string,
  rawMl: number,
  formData?: FormData,
): Promise<void> {
  const userId = await requireActionUser(formData);
  const today = await getUserToday(new Date());
  const date = parseDiaryDate(rawDate, today);
  const ml = parseWaterMl(rawMl);
  if (!date || ml === null) notFound();
  const result = await addWater(db, userId, { date, ml, requestId: readRequestId(formData) });
  if (result === "limit") redirect(withToast(dayHref(date, today), "waterFull"));
  if (result === "total_limit") redirect(withToast(dayHref(date, today), "waterTotalFull"));
  // A key spent on another amount or day is a tampered request: back to the day, nothing written.
  redirect(dayHref(date, today));
}

// A replayed or foreign removal finds nothing and lands on the same day, as the first one did.
export async function removeWaterAction(entryId: string, rawDate: string): Promise<void> {
  const userId = await requireWriteUser();
  const today = await getUserToday(new Date());
  const id = parseId(entryId);
  const removed = id ? await removeWater(db, userId, id) : null;
  redirect(dayHref(removed?.date ?? parseDiaryDate(rawDate, today) ?? today, today));
}
