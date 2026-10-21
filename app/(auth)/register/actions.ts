"use server";

import { headers } from "next/headers";
import { db } from "@/db/client";
import { registerLimiter } from "@/lib/auth/limiters";
import { hashPassword } from "@/lib/auth/password";
import { registerUser, type RegisterResult } from "@/lib/auth/register";
import { clientIpFromForwardedFor } from "@/lib/auth/request";
import { readRequestId } from "@/lib/request-id";
import { isRegistrationOpen } from "@/lib/env";
import { createUser } from "@/lib/users/repo";

// Public by design: there is no session before sign-up. It is closed unless REGISTRATION=open
// (#27); when open, abuse is bounded by the per-IP rate limit inside registerUser, and new
// accounts always get the unprivileged "user" role.
export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const ip = clientIpFromForwardedFor((await headers()).get("x-forwarded-for"));
  const requestId = readRequestId(formData);
  return registerUser(Object.fromEntries(formData), ip, {
    limiter: registerLimiter,
    nowMs: Date.now(),
    hashPassword,
    createUser: (email, passwordHash) => createUser(db, { email, passwordHash, requestId }),
    registrationOpen: isRegistrationOpen(),
  });
}
