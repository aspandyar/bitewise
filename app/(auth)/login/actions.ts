"use server";

import { cookies } from "next/headers";
import { db } from "@/db/client";
import { deviceCookie } from "@/lib/auth/device";
import { getSessionUserId } from "@/lib/auth/session";
import { readAuthEnv } from "@/lib/env";
import { findAuthState } from "@/lib/users/repo";

// Called right after a successful sign-in (and after a password change, which revokes the old
// mark): the mark is made for the account of this session only (#30).
export async function rememberDeviceAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;
  const state = await findAuthState(db, userId);
  if (!state) return;
  const env = readAuthEnv();
  const { name, value, options } = deviceCookie(
    { id: userId, tokenVersion: state.tokenVersion },
    {
      secret: env.NEXTAUTH_SECRET,
      https: new URL(env.NEXTAUTH_URL).protocol === "https:",
      nowMs: Date.now(),
    },
  );
  (await cookies()).set(name, value, options);
}
