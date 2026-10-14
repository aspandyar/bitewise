import { DrizzleQueryError } from "drizzle-orm/errors";

// A failed query's message and fields carry the SQL and its parameters: search text, user ids,
// emails. Logs keep only the database's own error (SQLSTATE code and message), which is what
// diagnosis needs.
export function loggableError(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  const cause: unknown = error.cause;
  if (!(cause instanceof Error)) return { name: error.name };
  const code = "code" in cause ? cause.code : undefined;
  return { name: cause.name, code, message: cause.message };
}
