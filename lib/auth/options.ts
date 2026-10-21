import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { AUTH } from "@/lib/config";
import { readAuthEnv } from "@/lib/env";
import { findUserByEmail } from "@/lib/users/repo";
import { authorizeCredentials } from "./authorize";
import { loginLimiter } from "./limiters";
import { getDummyPasswordHash, verifyPassword } from "./password";
import { clientIpFromForwardedFor, forwardedForHeader } from "./request";

const env = readAuthEnv();

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
        });
        // Auth.js passes a thrown message to the client as `error`; this one is a fixed code.
        if (result === "busy") throw new Error(AUTH.busySignInError);
        return result;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      // A token without a role predates roles; treating it as "user" never grants extra rights.
      return { ...session, user: { id: token.sub ?? "", role: token.role ?? "user" } };
    },
  },
};
