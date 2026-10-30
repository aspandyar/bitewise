import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { getSessionUserId } from "@/lib/auth/session";
import { z } from "zod";
import { BARCODE, OFF } from "@/lib/config";
import { findFoodByBarcode, saveOffFood } from "@/lib/foods/barcode-repo";
import { handleBarcodeLookup } from "@/lib/foods/barcode-lookup";
import {
  barcodeLookupLimiter,
  offOutboundLimiter,
  offOutboundPerUserLimiter,
} from "@/lib/foods/limiters";
import { fetchOffProduct, OFF_USER_AGENT } from "@/lib/foods/off";

const typedFlag = z.literal(BARCODE.typedValue);

export async function GET(request: NextRequest) {
  const result = await handleBarcodeLookup(
    {
      userId: await getSessionUserId(),
      rawCode: request.nextUrl.searchParams.get("code"),
      nowMs: Date.now(),
      fetchSite: request.headers.get("sec-fetch-site"),
      // Anything but the exact flag means a scan: the extra reading is never forced by junk.
      typed: typedFlag.safeParse(request.nextUrl.searchParams.get(BARCODE.typedParam)).success,
    },
    {
      userLimiter: barcodeLookupLimiter,
      offLimiter: offOutboundLimiter,
      offUserLimiter: offOutboundPerUserLimiter,
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
