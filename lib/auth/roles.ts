import type { UserRole } from "@/lib/config";

// Roles an admin may hand out from the app. "admin" itself is deliberately absent: it exists only
// through the bootstrap script, so no in-app bug or stolen admin session can mint another admin.
const ASSIGNABLE_ROLES: ReadonlySet<UserRole> = new Set(["user", "manager"]);

export function canAssignRole(actor: UserRole, current: UserRole, next: UserRole): boolean {
  return actor === "admin" && current !== "admin" && ASSIGNABLE_ROLES.has(next);
}
