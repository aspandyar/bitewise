import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { labelSourceSchema, seedFileSchema, usdaSourceSchema } from "@/lib/foods/seed-schema";
import { buildSeedFoods, collectUsdaNutrients } from "@/lib/foods/usda";

// Usage: pnpm seed:build <dir with SR Legacy CSV files>. Rebuilds db/seed/foods.json.
const csvDir = process.argv[2];
if (!csvDir) {
  console.error("Usage: pnpm seed:build <sr-legacy-csv-dir>");
  process.exit(1);
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const usda = usdaSourceSchema.parse(readJson("db/seed/sources/usda.json"));
const label = labelSourceSchema.parse(readJson("db/seed/sources/label.json"));

const lines = readFileSync(join(csvDir, "food_nutrient.csv"), "utf8").split(/\r?\n/);
const nutrients = collectUsdaNutrients(lines, new Set(usda.map((entry) => entry.fdcId)));
const seed = seedFileSchema.parse(buildSeedFoods(usda, label, nutrients));

writeFileSync("db/seed/foods.json", `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Wrote ${seed.length} foods to db/seed/foods.json`);
