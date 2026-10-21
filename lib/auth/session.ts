import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isForeignRequest } from "@/lib/request-id";
import { withToast } from "@/lib/toast";
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

// For actions that receive a form: a replay sent after the device signed in as someone else
// (#107) carries the first user's id and must not write into the second account. It lands on
// the day screen of whoever is signed in now and says why nothing was saved.
export async function requireActionUser(formData: FormData | undefined): Promise<string> {
  const userId = await requireUserId();
  if (isForeignRequest(formData, userId)) redirect(withToast("/", "otherAccount"));
  return userId;
}
