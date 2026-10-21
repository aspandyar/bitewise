import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { AUTH } from "@/lib/config";
import { readAuthEnv } from "@/lib/env";
import { findAuthState, findUserByEmail } from "@/lib/users/repo";
import { authorizeCredentials } from "./authorize";
import { loginLimiter } from "./limiters";
import { getDummyPasswordHash, verifyPassword } from "./password";
import { clientIpFromForwardedFor, forwardedForHeader } from "./request";
import { checkToken } from "./token";
import { isTrustedDevice } from "./device";

const env = readAuthEnv();
const deviceOptions = {
  secret: env.NEXTAUTH_SECRET,
  https: new URL(env.NEXTAUTH_URL).protocol === "https:",
};

// Auth.js hands headers through as Node's IncomingHttpHeaders; a cookie header is one string.
function cookieHeader(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  // Credentials in Auth.js only work with JWT sessions.
  session: { strategy: "jwt", maxAge: AUTH.sessionMaxAgeSec },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, req) {
        const ip = clientIpFromForwardedFor(forwardedForHeader(req.headers?.["x-forwarded-for"]));
        const result = await authorizeCredentials(credentials, ip, {
          findUserByEmail: (email) => findUserByEmail(db, email),
          verifyPassword,
          getDummyPasswordHash,
          limiter: loginLimiter,
          nowMs: Date.now(),
          isTrustedDevice: (account) =>
            isTrustedDevice(cookieHeader(req.headers?.cookie), account, {
              ...deviceOptions,
              nowMs: Date.now(),
            }),
        });
        // Auth.js passes a thrown message to the client as `error`; this one is a fixed code.
        if (result === "busy") throw new Error(AUTH.busySignInError);
        return result;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.ver = user.tokenVersion;
        return token;
      }
      // A revoked token (password changed, signed out everywhere) becomes an empty one: the
      // session then has no user id, and every page sends the visitor to /login (#29).
      return (await checkToken(token, { findAuthState: (id) => findAuthState(db, id) })) ?? {};
    },
    session({ session, token }) {
      // A token without a role predates roles; treating it as "user" never grants extra rights.
      return { ...session, user: { id: token.sub ?? "", role: token.role ?? "user" } };
    },
  },
};
