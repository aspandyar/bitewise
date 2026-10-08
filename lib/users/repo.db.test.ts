import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createUser, findUserByEmail } from "./repo";

beforeEach(resetDb);
afterAll(closeTestDb);

describe("users repo", () => {
  it("creates a user and finds it by email", async () => {
    const created = await createUser(testDb, { email: "me@example.com", passwordHash: "h" });
    expect(created?.id).toEqual(expect.any(String));
    expect(await findUserByEmail(testDb, "me@example.com")).toEqual({
      id: created?.id,
      passwordHash: "h",
    });
  });

  it("returns null instead of throwing when the email is taken", async () => {
    await createUser(testDb, { email: "me@example.com", passwordHash: "h1" });
    expect(await createUser(testDb, { email: "me@example.com", passwordHash: "h2" })).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await findUserByEmail(testDb, "nobody@example.com")).toBeNull();
  });
});
