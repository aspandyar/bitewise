import type { Db } from "@/db/types";
import { canAssignRole } from "@/lib/auth/roles";
import { emailSchema } from "@/lib/auth/schema";
import type { UserRole } from "@/lib/config";
import { findUserRoleByEmail, findUserRoleById, setUserRole } from "./repo";

export type ChangeRoleResult = "ok" | "forbidden" | "not_found";

// The actor's role is read from the database, not from the session token, so a demoted or
// deleted admin cannot keep changing roles until their JWT expires.
export async function changeUserRole(
  db: Db,
  actorId: string,
  targetEmail: string,
  next: UserRole,
): Promise<ChangeRoleResult> {
  const email = emailSchema.safeParse(targetEmail);
  if (!email.success) return "not_found";

  return db.transaction(async (tx) => {
    const actorRole = await findUserRoleById(tx, actorId);
    if (!actorRole) return "forbidden";
    const target = await findUserRoleByEmail(tx, email.data);
    if (!target) return "not_found";
    if (!canAssignRole(actorRole, target.role, next)) return "forbidden";
    await setUserRole(tx, target.id, next);
    return "ok";
  });
}
