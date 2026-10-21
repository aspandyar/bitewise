import "server-only";
import { readDbEnv } from "@/lib/env";
import { connectDb } from "./connect";

// A client component importing the database fails the build (#32); scripts use db/connect.
export const { sql, db } = connectDb(readDbEnv().DATABASE_URL);
