import { readFileSync } from "node:fs";
import { connectDb } from "@/db/connect";
import { readDbEnv } from "@/lib/env-read";
import { loadFoodSeed } from "@/lib/foods/seed";
import { seedFileSchema } from "@/lib/foods/seed-schema";

// Scripts run outside Next, where "server-only" throws (#32).
const { db, sql } = connectDb(readDbEnv().DATABASE_URL);

// Safe to run on every deploy: upserts by seed key and never touches users' own foods.
// Scripts run as CommonJS through tsx, so no top-level await and paths are from the repo root.
async function main() {
  try {
    const seed = seedFileSchema.parse(JSON.parse(readFileSync("db/seed/foods.json", "utf8")));
    const { upserted, retired, recomputed, failed } = await loadFoodSeed(db, seed);
    console.log(
      `Seeded ${upserted} foods, retired ${retired}, recomputed ${recomputed} recipes (${failed} failed).`,
    );
    // The foods are in; a failed recipe is logged above and fails the release step to be looked at.
    if (failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
