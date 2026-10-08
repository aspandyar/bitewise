import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest only exposes VITE_* vars by default; DB tests need DATABASE_URL_TEST from .env.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["**/*.db.test.ts", "node_modules/**", ".next/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["**/*.db.test.ts"],
          globalSetup: ["tests/global-setup.ts"],
          // Files share one database and truncate it, so they must not run concurrently.
          fileParallelism: false,
        },
      },
    ],
  },
});
