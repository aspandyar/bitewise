import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";

function requireTestUrl(): string {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  return value;
}

const url = requireTestUrl();

const client = postgres(url, { max: 1, onnotice: () => {} });
export const testDb: Db = drizzle(client, { schema });

// Every user-owned table cascades from users, so one truncate clears the whole state.
export async function resetDb(): Promise<void> {
  await testDb.execute(sql`TRUNCATE users CASCADE`);
}

// testDb has one connection, so its transactions never overlap; race tests need a real pool.
export function createTestPool(max: number): { db: Db; close: () => Promise<void> } {
  const pool = postgres(url, { max, onnotice: () => {} });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

export async function closeTestDb(): Promise<void> {
  await client.end();
}
