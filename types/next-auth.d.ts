import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/config";

// The session carries only the user id and role; everything else is loaded from the database.
// Every session read re-checks the token version and role against the database (#29).
declare module "next-auth" {
  interface User {
    role: UserRole;
    tokenVersion: number;
  }

  interface Session {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    // users.token_version at sign-in; absent on tokens issued before #29.
    ver?: number;
  }
}
