import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readServerEnv } from "@/lib/env";
import * as schema from "./schema";

const { DATABASE_URL } = readServerEnv();

export const sql = postgres(DATABASE_URL);
export const db = drizzle(sql, { schema });
