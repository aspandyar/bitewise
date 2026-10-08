import { z } from "zod";

// Fail fast on startup instead of on the first query when the env is misconfigured.
const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
