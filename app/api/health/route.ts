import { connection } from "next/server";
import { sql } from "@/db/client";
import { HEALTH } from "@/lib/config";
import { handleHealth } from "@/lib/ops/health";

// Request-time on purpose: a prerendered "ok" would say nothing about the live database.
export async function GET() {
  await connection();
  const result = await handleHealth(async () => {
    await sql`select 1`;
  }, HEALTH.timeoutMs);
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
