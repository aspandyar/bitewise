import { DrizzleQueryError } from "drizzle-orm/errors";

// A failed query carries the SQL and its parameters (search text, user ids, emails), and
// Postgres messages can echo a parameter too ('invalid input syntax for type uuid: "…"').
// Logs keep only the error class and SQLSTATE code, which is enough to find the cause.
export function loggableError(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  const cause: unknown = error.cause;
  if (!(cause instanceof Error)) return { name: error.name };
  const code = "code" in cause ? cause.code : undefined;
  return { name: cause.name, code };
}
