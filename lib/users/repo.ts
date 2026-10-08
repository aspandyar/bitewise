import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Db } from "@/db/types";
import type { UserRole } from "@/lib/config";

export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const [row] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

// A taken email yields null rather than a unique-violation error, so sign-up can answer generically.
export async function createUser(
  db: Db,
  input: { email: string; passwordHash: string },
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(users)
    .values(input)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  return row ?? null;
}

export async function findUserRoleById(db: Db, id: string): Promise<UserRole | null> {
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  return row?.role ?? null;
}

export async function findUserRoleByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; role: UserRole } | null> {
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

export async function setUserRole(db: Db, id: string, role: UserRole): Promise<void> {
  await db.update(users).set({ role }).where(eq(users.id, id));
}
