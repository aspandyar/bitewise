import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { readDbEnv } from "@/lib/env";
import { checkDatabase } from "@/lib/ops/db-checks";

// Same journal table as drizzle-kit (drizzle.__drizzle_migrations), so dev and prod agree on what
// is applied. Runs before the new app container starts; a failure stops the release.
// Bundled to ops/migrate.js (CommonJS), so no top-level await; paths are from the image root.
async function main() {
  const client = postgres(readDbEnv().DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "db/migrations" });
    const problems = await checkDatabase(db);
    if (problems.length > 0) throw new Error(problems.join("; "));
    console.log("Migrations applied, database checks passed.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
