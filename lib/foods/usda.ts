import { NUTRIENT_STORAGE_DECIMALS, USDA_NUTRIENT_IDS } from "@/lib/config";
import { calcNetCarbsPer100g } from "@/lib/nutrition";
import type { LabelSource, SeedFood, UsdaSource } from "./seed-schema";

type NutrientKey = keyof typeof USDA_NUTRIENT_IDS;
export type UsdaNutrients = Partial<Record<NutrientKey, number>>;

const keyByNutrientId = new Map<number, NutrientKey>(
  Object.entries(USDA_NUTRIENT_IDS).map(([key, id]) => [id, key as NutrientKey]),
);

// SR Legacy quotes every field and has no line breaks inside fields, so a line-level parser
// is enough; anything unexpected throws instead of silently shifting columns.
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error(`unterminated quote in CSV line: ${line.slice(0, 80)}`);
  fields.push(field);
  return fields;
}

export function collectUsdaNutrients(
  lines: readonly string[],
  fdcIds: ReadonlySet<number>,
): Map<number, UsdaNutrients> {
  const [headerLine, ...rows] = lines;
  const header = parseCsvLine(headerLine ?? "");
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`food_nutrient.csv has no "${name}" column`);
    return index;
  };
  const fdcColumn = column("fdc_id");
  const nutrientColumn = column("nutrient_id");
  const amountColumn = column("amount");

  const result = new Map<number, UsdaNutrients>();
  rows.forEach((line, index) => {
    if (line.trim() === "") return;
    const fields = parseCsvLine(line);
    if (fields.length !== header.length) {
      throw new Error(`food_nutrient.csv line ${index + 2}: expected ${header.length} columns`);
    }
    const fdcId = Number(fields[fdcColumn]);
    const key = keyByNutrientId.get(Number(fields[nutrientColumn]));
    if (!fdcIds.has(fdcId) || !key) return;
    const amount = Number(fields[amountColumn]);
    if (!Number.isFinite(amount)) {
      throw new Error(`food_nutrient.csv line ${index + 2}: amount is not a number`);
    }
    result.set(fdcId, { ...result.get(fdcId), [key]: amount });
  });
  return result;
}

const scale = 10 ** NUTRIENT_STORAGE_DECIMALS;
const toStored = (value: number) => Math.round(value * scale) / scale;

function requireNutrient(key: string, nutrients: UsdaNutrients, name: NutrientKey): number {
  const value = nutrients[name];
  if (value === undefined) throw new Error(`${key}: USDA data has no ${name}`);
  return value;
}

export function buildSeedFoods(
  usda: readonly UsdaSource[],
  label: readonly LabelSource[],
  nutrients: ReadonlyMap<number, UsdaNutrients>,
): SeedFood[] {
  const fromUsda = usda.map((entry): SeedFood => {
    const key = `usda:${entry.fdcId}`;
    const data = nutrients.get(entry.fdcId);
    if (!data) throw new Error(`${key}: fdcId not found in food_nutrient.csv`);
    const fiber = data.fiber ?? null;
    return {
      key,
      name: entry.name,
      source: "usda",
      kcal100: toStored(requireNutrient(key, data, "kcal")),
      protein100: toStored(requireNutrient(key, data, "protein")),
      fat100: toStored(requireNutrient(key, data, "fat")),
      carbs100: toStored(
        calcNetCarbsPer100g(requireNutrient(key, data, "carbsByDifference"), fiber),
      ),
      fiber100: fiber === null ? null : toStored(fiber),
      sourceUrl: null,
      portions: entry.portions,
    };
  });
  const fromLabel = label.map(({ slug, ...entry }): SeedFood => ({
    key: `label:${slug}`,
    source: "label",
    ...entry,
  }));
  // Sorted output keeps git diffs of foods.json down to the rows that really changed.
  return [...fromUsda, ...fromLabel].sort((a, b) => a.key.localeCompare(b.key));
}
