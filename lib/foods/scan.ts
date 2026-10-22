import { SCANNER, type Meal } from "@/lib/config";
import type { IsoDate } from "@/lib/date";
import { addFoodHref } from "@/lib/diary/paths";
import type { BarcodeLookupBody } from "./barcode-lookup";
import { newFoodHref } from "./hints";

export type ScanTarget = { kind: "diary"; date: IsoDate; meal: Meal } | { kind: "foods" };

// The camera reads the same pack on every frame; without this one scan would fire a request per
// frame and navigate several times.
export function shouldSubmitCode(
  last: { code: string; atMs: number } | null,
  code: string,
  nowMs: number,
): boolean {
  return last === null || last.code !== code || nowMs - last.atMs >= SCANNER.sameCodeMs;
}

const entryOf = (target: ScanTarget) =>
  target.kind === "diary" ? { date: target.date, meal: target.meal } : undefined;

export function newFoodForCode(code: string, target: ScanTarget): string {
  return newFoodHref({ barcode: code, hints: {}, fromOff: false, entry: entryOf(target) });
}

// Where a lookup sends the user; null keeps them on the scanner with a message.
export function scanTargetHref(body: BarcodeLookupBody, target: ScanTarget): string | null {
  if ("error" in body) return null;
  switch (body.status) {
    case "found":
      return target.kind === "diary"
        ? addFoodHref(body.foodId, target.date, target.meal)
        : `/foods/${body.foodId}`;
    case "not_found":
      return newFoodHref({
        barcode: body.code,
        hints: body.hints,
        // Hints only ever come from Open Food Facts, so they are what earns the credit.
        fromOff: Object.keys(body.hints).length > 0,
        entry: entryOf(target),
      });
    case "unavailable":
      return null;
  }
}
