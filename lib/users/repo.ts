import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Db } from "@/db/types";

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
