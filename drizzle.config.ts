import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { readDbEnv } from "./lib/env-read";

// drizzle-kit does not read .env itself; CI passes variables directly, so the file is optional.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: readDbEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
