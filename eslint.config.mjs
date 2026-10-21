import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The app reaches the database and secrets only through the server-only entries (#32); the
  // plain ones are for scripts that run outside Next.
  {
    files: ["app/**", "components/**", "lib/**"],
    ignores: ["lib/env.ts", "lib/env-read.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/env-read", "./env-read", "@/db/connect"],
              message: "Use @/lib/env or @/db/client: they are marked server-only (#32).",
            },
          ],
        },
      ],
    },
  },
  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "db/migrations/**",
    // Bundles built by `pnpm ops:build`, not source.
    "ops/**",
    ".local-prod/**",
  ]),
]);

export default eslintConfig;
