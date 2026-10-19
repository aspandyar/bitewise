import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, testDb } from "@/tests/db";
import { checkDatabase } from "./db-checks";

afterAll(closeTestDb);

describe("checkDatabase", () => {
  it("passes on a migrated database with a Unicode-aware locale", async () => {
    expect(await checkDatabase(testDb)).toEqual([]);
  });
});
