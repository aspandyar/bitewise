import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { getSessionUserId } from "@/lib/auth/session";
import { foodSearchLimiter } from "@/lib/foods/limiters";
import { searchFoods } from "@/lib/foods/repo";
import { handleFoodSearch } from "@/lib/foods/search-api";

export async function GET(request: NextRequest) {
  const result = await handleFoodSearch(
    {
      userId: await getSessionUserId(),
      rawQuery: request.nextUrl.searchParams.get("q"),
      nowMs: Date.now(),
    },
    { limiter: foodSearchLimiter, search: (userId, query) => searchFoods(db, userId, query) },
  );
  // Results depend on the user and change as they add foods, so nothing may cache them.
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
