import "server-only";
import { z } from "zod";
import { FOOD_LIMITS, NUTRIENT_BASE_GRAMS, OFF, PORTION_LIMITS } from "@/lib/config";
import { version } from "@/package.json";
import { foodSchema } from "./schema";
import type { FoodValues } from "./types";

export const OFF_USER_AGENT = `${OFF.appName}/${version} (${OFF.contactUrl})`;

// What a scan can still offer the own-food form when the product is not usable as it is.
export type FoodHints = {
  name?: string;
  kcal100?: number;
  protein100?: number;
  fat100?: number;
  carbs100?: number;
  fiber100?: number;
};

export type OffProduct =
  | { kind: "found"; values: FoodValues; portionGrams: number | null; sourceUrl: string }
  | { kind: "incomplete"; hints: FoodHints }
  | { kind: "not_found" };

const NUMERIC_STRING = /^\d+(\.\d+)?$/;

// Their numbers are usually JSON numbers but sometimes strings ("50"); anything else is unknown.
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && NUMERIC_STRING.test(value.trim())) return Number(value.trim());
  return undefined;
}

const text = z.string().optional().catch(undefined);

const responseSchema = z.object({
  status: z.literal(1),
  product: z.object({
    product_name: text,
    product_name_ru: text,
    generic_name: text,
    generic_name_ru: text,
    brands: text,
    serving_quantity: z.unknown(),
    nutriments: z.record(z.string(), z.unknown()).optional().catch(undefined),
  }),
});

type OffFields = z.infer<typeof responseSchema>["product"];

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", "#39": "'", lt: "<", gt: ">" };

// Some names arrive HTML-escaped ("&quot;банан&quot;"); React would show the escapes as text.
function decodeEntities(value: string): string {
  return value.replace(/&(amp|quot|apos|#39|lt|gt);/g, (_, entity: string) => ENTITIES[entity] ?? "");
}

function productName(product: OffFields): string | undefined {
  const base = [product.product_name_ru, product.product_name, product.generic_name_ru, product.generic_name]
    .map((name) => decodeEntities(name ?? "").trim())
    .find((name) => name !== "");
  if (!base) return undefined;
  const brand = decodeEntities(product.brands ?? "").split(",")[0]?.trim();
  // Two bars from different brands often share a name like "Протеиновый батончик".
  const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base;
  return name.slice(0, FOOD_LIMITS.nameLength.max).trim();
}

// Per-100 g figures first; a per-serving figure only scales to 100 g by a known serving weight.
// Energy in kJ alone is a unit conversion, not a guess; kcal is never derived from the macros.
function per100(
  nutriments: Record<string, unknown>,
  key: string,
  servingGrams: number | undefined,
): number | undefined {
  const direct = toNumber(nutriments[`${key}_100g`]);
  if (direct !== undefined) return direct;
  const perServing = toNumber(nutriments[`${key}_serving`]);
  if (perServing === undefined || !servingGrams) return undefined;
  return (perServing * NUTRIENT_BASE_GRAMS) / servingGrams;
}

function kcalPer100(nutriments: Record<string, unknown>, servingGrams: number | undefined) {
  const kcal = per100(nutriments, "energy-kcal", servingGrams);
  if (kcal !== undefined) return kcal;
  const kj = per100(nutriments, "energy-kj", servingGrams) ?? per100(nutriments, "energy", servingGrams);
  return kj === undefined ? undefined : kj / OFF.kjPerKcal;
}

// A hint is only offered when it would pass the food form on its own.
function withinLimits(value: number | undefined, limits: { min: number; max: number }) {
  return value !== undefined && value >= limits.min && value <= limits.max ? value : undefined;
}

export function parseOffProduct(json: unknown, code: string): OffProduct {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return { kind: "not_found" };
  const product = parsed.data.product;
  const nutriments = product.nutriments ?? {};
  const servingGrams = toNumber(product.serving_quantity);

  const hints: FoodHints = {
    name: productName(product),
    kcal100: withinLimits(kcalPer100(nutriments, servingGrams), FOOD_LIMITS.kcal100),
    protein100: withinLimits(per100(nutriments, "proteins", servingGrams), FOOD_LIMITS.nutrient100G),
    fat100: withinLimits(per100(nutriments, "fat", servingGrams), FOOD_LIMITS.nutrient100G),
    carbs100: withinLimits(per100(nutriments, "carbohydrates", servingGrams), FOOD_LIMITS.nutrient100G),
    fiber100: withinLimits(per100(nutriments, "fiber", servingGrams), FOOD_LIMITS.nutrient100G),
  };
  for (const key of Object.keys(hints) as (keyof FoodHints)[]) {
    if (hints[key] === undefined) delete hints[key];
  }

  // The same gate as the form, so a cached product could also have been typed in by hand.
  const values = foodSchema.safeParse({ ...hints, fiber100: hints.fiber100 ?? null });
  if (!values.success) return { kind: "incomplete", hints };
  return {
    kind: "found",
    values: values.data,
    portionGrams: withinLimits(servingGrams, PORTION_LIMITS.grams) ?? null,
    sourceUrl: `${OFF.productPageUrl}${code}`,
  };
}

const NOT_FOUND_STATUS = 404;

export async function fetchOffProduct(
  code: string,
  deps: { fetch: typeof fetch; timeoutMs: number; userAgent: string },
): Promise<OffProduct | { kind: "unavailable" }> {
  try {
    const response = await deps.fetch(`${OFF.productUrl}${code}?fields=${OFF.fields.join(",")}`, {
      headers: { "User-Agent": deps.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    if (!response.ok && response.status !== NOT_FOUND_STATUS) return { kind: "unavailable" };
    const json: unknown = await response.json();
    if (response.status === NOT_FOUND_STATUS) {
      // An unknown code is a 404 with their JSON; a 404 page from a proxy is an outage.
      const unknownCode = z.object({ status: z.literal(0) }).safeParse(json).success;
      return unknownCode ? { kind: "not_found" } : { kind: "unavailable" };
    }
    return parseOffProduct(json, code);
  } catch {
    // Timeouts, network errors and bodies that are not JSON all mean "try again later".
    return { kind: "unavailable" };
  }
}
