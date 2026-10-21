"use server";

import { cookies } from "next/headers";
import { deviceCookie } from "@/lib/auth/device";
import { getSessionUserId } from "@/lib/auth/session";
import { readAuthEnv } from "@/lib/env";

// Called right after a successful sign-in: the mark is made for the account of this session
// only, so a request cannot ask for another account's mark (#30).
export async function rememberDeviceAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;
  const env = readAuthEnv();
  const { name, value, options } = deviceCookie(userId, {
    secret: env.NEXTAUTH_SECRET,
    https: new URL(env.NEXTAUTH_URL).protocol === "https:",
  });
  (await cookies()).set(name, value, options);
}
