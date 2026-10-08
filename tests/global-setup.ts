import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Runs once per `vitest run`: brings the test database to the latest migration.
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
  await client.end();
}
