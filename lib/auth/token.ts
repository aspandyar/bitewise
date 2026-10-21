import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@/lib/config";

export type AuthState = { role: UserRole; tokenVersion: number };

// Runs on every session read (#29). A JWT is valid until it expires, so a password change or
// "sign out everywhere" bumps the account's version and every older token stops counting. The
// role comes from the database too, instead of staying a snapshot from sign-in.
export async function checkToken(
  token: JWT,
  deps: { findAuthState(userId: string): Promise<AuthState | null> },
): Promise<JWT | null> {
  if (!token.sub) return token;
  const state = await deps.findAuthState(token.sub);
  // Tokens issued before versions existed carry none and count as version 0.
  if (!state || (token.ver ?? 0) !== state.tokenVersion) return null;
  return { ...token, role: state.role };
}
