import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user.id || null;
}

// Pages and server actions call this first; layouts do not, because with cacheComponents
// a session read at the top of a layout would block the whole segment.
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}
