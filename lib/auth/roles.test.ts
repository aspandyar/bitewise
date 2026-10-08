import { describe, expect, it } from "vitest";
import type { UserRole } from "@/lib/config";
import { canAssignRole } from "./roles";

describe("canAssignRole", () => {
  it.each<[UserRole, UserRole, UserRole]>([
    ["admin", "user", "manager"],
    ["admin", "manager", "user"],
  ])("lets %s move a %s to %s", (actor, current, next) => {
    expect(canAssignRole(actor, current, next)).toBe(true);
  });

  it.each<[UserRole, UserRole, UserRole]>([
    ["admin", "user", "admin"], // admin is only created by the bootstrap script
    ["admin", "admin", "user"], // nobody can demote an admin through the app
    ["admin", "admin", "manager"],
    ["manager", "user", "manager"], // managers work with users but never change roles
    ["manager", "manager", "user"],
    ["user", "user", "manager"],
  ])("refuses %s moving a %s to %s", (actor, current, next) => {
    expect(canAssignRole(actor, current, next)).toBe(false);
  });
});
