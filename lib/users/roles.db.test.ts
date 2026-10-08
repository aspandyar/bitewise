import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import type { UserRole } from "@/lib/config";
import { closeTestDb, resetDb, testDb } from "@/tests/db";
import { createUser } from "./repo";
import { changeUserRole } from "./roles";

async function newUser(email: string, role: UserRole = "user"): Promise<string> {
  const user = await createUser(testDb, { email, passwordHash: "h" });
  if (!user) throw new Error("user not created");
  await testDb.update(users).set({ role }).where(eq(users.id, user.id));
  return user.id;
}

async function roleOf(email: string): Promise<UserRole | undefined> {
  const [row] = await testDb.select({ role: users.role }).from(users).where(eq(users.email, email));
  return row?.role;
}

beforeEach(resetDb);
afterAll(closeTestDb);

describe("changeUserRole", () => {
  it("lets an admin promote a user to manager and back", async () => {
    const admin = await newUser("admin@bitewise.invalid", "admin");
    await newUser("bob@mail.com");

    expect(await changeUserRole(testDb, admin, "bob@mail.com", "manager")).toBe("ok");
    expect(await roleOf("bob@mail.com")).toBe("manager");
    expect(await changeUserRole(testDb, admin, "bob@mail.com", "user")).toBe("ok");
    expect(await roleOf("bob@mail.com")).toBe("user");
  });

  it("refuses a manager and leaves the role unchanged", async () => {
    const manager = await newUser("m@mail.com", "manager");
    await newUser("bob@mail.com");

    expect(await changeUserRole(testDb, manager, "bob@mail.com", "manager")).toBe("forbidden");
    expect(await roleOf("bob@mail.com")).toBe("user");
  });

  it("never creates another admin", async () => {
    const admin = await newUser("admin@bitewise.invalid", "admin");
    await newUser("bob@mail.com");

    expect(await changeUserRole(testDb, admin, "bob@mail.com", "admin")).toBe("forbidden");
    expect(await roleOf("bob@mail.com")).toBe("user");
  });

  it("normalizes the target email", async () => {
    const admin = await newUser("admin@bitewise.invalid", "admin");
    await newUser("bob@mail.com");

    expect(await changeUserRole(testDb, admin, "  Bob@Mail.com ", "manager")).toBe("ok");
  });

  it("reports an unknown target", async () => {
    const admin = await newUser("admin@bitewise.invalid", "admin");
    expect(await changeUserRole(testDb, admin, "ghost@mail.com", "manager")).toBe("not_found");
  });
});
