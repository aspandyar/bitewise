import { sql } from "drizzle-orm";
import type { Db } from "./types";

// Serializes one user's capped writes (diary entries, own portions), so parallel submits cannot
// all pass a count check. One key per user for every cap: contention between them is negligible.
export async function lockUserWrites(tx: Db, userId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
}
