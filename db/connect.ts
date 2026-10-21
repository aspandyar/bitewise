import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Shared by the app's client (db/client.ts, server-only) and the scripts, which run outside Next.
export function connectDb(databaseUrl: string) {
  const sql = postgres(databaseUrl);
  return { sql, db: drizzle(sql, { schema }) };
}
