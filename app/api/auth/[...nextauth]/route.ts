import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

// The only route without a session check: it is where sessions are created.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
