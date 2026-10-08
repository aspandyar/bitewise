import type { DefaultSession } from "next-auth";

// The session carries only the user id; everything else is loaded from the database.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
