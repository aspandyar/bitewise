import { readFileSync } from "node:fs";
import { db, sql } from "@/db/client";
import { loadFoodSeed } from "@/lib/foods/seed";
import { seedFileSchema } from "@/lib/foods/seed-schema";

// Safe to run on every deploy: upserts by seed key and never touches users' own foods.
// Scripts run as CommonJS through tsx, so no top-level await and paths are from the repo root.
async function main() {
  try {
    const seed = seedFileSchema.parse(JSON.parse(readFileSync("db/seed/foods.json", "utf8")));
    const { upserted, retired } = await loadFoodSeed(db, seed);
    console.log(`Seeded ${upserted} foods, retired ${retired}.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
