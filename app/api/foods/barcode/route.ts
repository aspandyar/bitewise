import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { getSessionUserId } from "@/lib/auth/session";
import { OFF } from "@/lib/config";
import { findFoodByBarcode, saveOffFood } from "@/lib/foods/barcode-repo";
import { handleBarcodeLookup } from "@/lib/foods/barcode-lookup";
import { barcodeLookupLimiter, offOutboundLimiter } from "@/lib/foods/limiters";
import { fetchOffProduct, OFF_USER_AGENT } from "@/lib/foods/off";

export async function GET(request: NextRequest) {
  const result = await handleBarcodeLookup(
    {
      userId: await getSessionUserId(),
      rawCode: request.nextUrl.searchParams.get("code"),
      nowMs: Date.now(),
    },
    {
      userLimiter: barcodeLookupLimiter,
      offLimiter: offOutboundLimiter,
      find: (userId, code) => findFoodByBarcode(db, userId, code),
      fetchOff: (code) =>
        fetchOffProduct(code, { fetch, timeoutMs: OFF.timeoutMs, userAgent: OFF_USER_AGENT }),
      saveOff: (code, product) => saveOffFood(db, code, product),
    },
  );
  // Own foods differ per user and a code unknown today may be added tomorrow.
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
