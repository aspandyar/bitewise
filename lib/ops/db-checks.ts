import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";

// Search lower()s Cyrillic names (foods.search_name); a C or non-UTF-8 locale would leave them
// upper-case and search would miss (#25). pg_trgm comes from a custom migration (#22).
export async function checkDatabase(db: Db): Promise<string[]> {
  const problems: string[] = [];
  const [lower] = await db.execute<{ ok: boolean }>(
    sql`select lower('ГРЕЧКА Ё') = 'гречка ё' as ok`,
  );
  if (!lower?.ok) {
    problems.push("lower() does not fold Cyrillic: check the database locale (datctype)");
  }
  const [trgm] = await db.execute<{ ok: boolean }>(
    sql`select exists (select 1 from pg_extension where extname = 'pg_trgm') as ok`,
  );
  if (!trgm?.ok) problems.push("pg_trgm extension is missing");
  return problems;
}
