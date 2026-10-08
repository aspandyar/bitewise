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
        return authorizeCredentials(credentials, ip, {
          findUserByEmail: (email) => findUserByEmail(db, email),
          verifyPassword,
          getDummyPasswordHash,
          limiter: loginLimiter,
          nowMs: Date.now(),
        });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      return { ...session, user: { id: token.sub ?? "" } };
    },
  },
};
