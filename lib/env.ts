import { z } from "zod";

// Separate schemas: drizzle-kit and scripts need only the DB URL, not auth secrets.
const dbEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

const authEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    // Auth.js signs JWTs with this; short secrets are brute-forceable.
    NEXTAUTH_SECRET: z.string().min(32),
    NEXTAUTH_URL: z.url(),
    SIGNUP_ALLOWLIST: z.string().default(""),
  })
  // Auth.js marks the session cookie Secure only for https URLs, so http in production would
  // send the JWT in clear text.
  .refine((env) => env.NODE_ENV !== "production" || env.NEXTAUTH_URL.startsWith("https://"), {
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
