"use server";

import { headers } from "next/headers";
import { db } from "@/db/client";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { registerLimiter } from "@/lib/auth/limiters";
import { hashPassword } from "@/lib/auth/password";
import { registerUser, type RegisterResult } from "@/lib/auth/register";
import { clientIpFromForwardedFor } from "@/lib/auth/request";
import { readAuthEnv } from "@/lib/env";
import { createUser } from "@/lib/users/repo";

// Public by design: there is no session before sign-up. Abuse is bounded by the allowlist
// and the per-IP rate limit inside registerUser.
export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = clientIpFromForwardedFor((await headers()).get("x-forwarded-for"));
  return registerUser(Object.fromEntries(formData), ip, {
    allowlist: parseAllowlist(readAuthEnv().SIGNUP_ALLOWLIST),
    limiter: registerLimiter,
    nowMs: Date.now(),
    hashPassword,
    createUser: (email, passwordHash) => createUser(db, { email, passwordHash }),
  });
}
