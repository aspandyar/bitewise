import { z } from "zod";

// Separate schemas: drizzle-kit and scripts need only the DB URL, not auth secrets.
const dbEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isSecureOrLoopback(url: string): boolean {
  const parsed = new URL(url);
  return parsed.protocol === "https:" || LOOPBACK_HOSTS.has(parsed.hostname);
}

const authEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    // Auth.js signs JWTs with this; short secrets are brute-forceable.
    NEXTAUTH_SECRET: z.string().min(32),
    NEXTAUTH_URL: z.url(),
  })
  // Auth.js marks the session cookie Secure only for https URLs, so http in production would
  // send the JWT in clear text. Loopback is exempt: a local production build never leaves the host.
  .refine((env) => env.NODE_ENV !== "production" || isSecureOrLoopback(env.NEXTAUTH_URL), {
    message: "NEXTAUTH_URL must use https in production",
    path: ["NEXTAUTH_URL"],
  });

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

// Fail fast on startup instead of on the first query when the env is misconfigured.
export function readDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return dbEnvSchema.parse(source);
}

export function readAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  return authEnvSchema.parse(source);
}

// Sign-up stays closed until bots and email probing are handled (#27): the owner opens it with
// REGISTRATION=open. A typo fails fast rather than silently opening or closing it.
const registrationSchema = z.object({
  REGISTRATION: z.enum(["open", "closed"]).default("closed"),
});

export function isRegistrationOpen(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return registrationSchema.parse(source).REGISTRATION === "open";
}
