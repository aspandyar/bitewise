import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readDbEnv } from "@/lib/env";
import * as schema from "./schema";

const { DATABASE_URL } = readDbEnv();

export const sql = postgres(DATABASE_URL);
export const db = drizzle(sql, { schema });
