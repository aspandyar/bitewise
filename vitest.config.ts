import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest only exposes VITE_* vars by default; DB tests need DATABASE_URL_TEST from .env.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Next resolves it to an empty module on the server; tests run server code directly.
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // .claude/ holds Claude Code session worktrees: other checkouts with their own tests and deps.
    exclude: ["node_modules/**", ".next/**", ".claude/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["**/*.db.test.ts", "node_modules/**", ".next/**", ".claude/**"],
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
