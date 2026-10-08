import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");

const client = postgres(url, { max: 1, onnotice: () => {} });
export const testDb: Db = drizzle(client, { schema });

// Every user-owned table cascades from users, so one truncate clears the whole state.
export async function resetDb(): Promise<void> {
  await testDb.execute(sql`TRUNCATE users CASCADE`);
}

export async function closeTestDb(): Promise<void> {
  await client.end();
}
