import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// The database client and the secrets must fail the build if a client component imports them
// (#32); scripts run outside Next, where "server-only" throws, so they use the plain entries.
describe("server-only boundary", () => {
  it.each(["db/client.ts", "lib/env.ts"])("%s is marked server-only", (path) => {
    expect(read(path)).toMatch(/^import "server-only";/m);
  });

  it.each(["db/seed/index.ts", "db/ops/migrate.ts", "scripts/bootstrap-admin.ts", "drizzle.config.ts"])(
    "%s uses the script entries, not the server-only ones",
    (path) => {
      expect(read(path)).not.toMatch(/from "(@\/db\/client|@\/lib\/env|\.\/lib\/env)"/);
    },
  );
});
