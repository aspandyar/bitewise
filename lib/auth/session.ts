import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authOptions } from "./options";

export async function getSessionUserId(): Promise<string | null> {
  // Marks the read as request-time: getServerSession touches cookies and crypto randomness,
  // which cacheComponents would otherwise try to evaluate during prerendering.
  await connection();
  const session = await getServerSession(authOptions);
  return session?.user.id || null;
}

// Server actions call this first; pages call it inside their own <Suspense> boundary so the
// static shell renders instantly and only the session-dependent part streams.
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}
