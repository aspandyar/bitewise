import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/config";

// The session carries only the user id and role; everything else is loaded from the database.
// The role is a snapshot from sign-in: privileged actions must re-read it from the database.
declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}
