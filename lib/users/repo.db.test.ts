import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createAdmin, createUser, findUserByEmail, updatePasswordHash } from "./repo";

beforeEach(resetDb);
afterAll(closeTestDb);

describe("users repo", () => {
  it("creates a user and finds it by email", async () => {
    const created = await createUser(testDb, { email: "me@example.com", passwordHash: "h" });
    expect(created?.id).toEqual(expect.any(String));
    expect(await findUserByEmail(testDb, "me@example.com")).toEqual({
      id: created?.id,
      passwordHash: "h",
      role: "user",
    });
  });

  it("returns null instead of throwing when the email is taken", async () => {
    await createUser(testDb, { email: "me@example.com", passwordHash: "h1" });
    expect(await createUser(testDb, { email: "me@example.com", passwordHash: "h2" })).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await findUserByEmail(testDb, "nobody@example.com")).toBeNull();
  });

  it("creates an admin explicitly with the admin role", async () => {
    await createAdmin(testDb, "admin@bitewise.invalid", "h");
    expect((await findUserByEmail(testDb, "admin@bitewise.invalid"))?.role).toBe("admin");
  });

  it("updates only the given user's password hash", async () => {
    const a = await createUser(testDb, { email: "a@example.com", passwordHash: "old" });
    await createUser(testDb, { email: "b@example.com", passwordHash: "old" });
    await updatePasswordHash(testDb, a?.id ?? "", "new");
    expect((await findUserByEmail(testDb, "a@example.com"))?.passwordHash).toBe("new");
    expect((await findUserByEmail(testDb, "b@example.com"))?.passwordHash).toBe("old");
  });
});
