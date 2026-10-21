import { DrizzleQueryError } from "drizzle-orm/errors";
import { LOG_SCRUB } from "@/lib/config";

// Drizzle's message is "Failed query: <sql>\nparams: <values>", and a stack starts with it.
const FAILED_QUERY = /Failed query:[\s\S]*/;
const SCRUBBED = Symbol.for("bitewise.scrubbedConsole");

function scrubQuery(error: DrizzleQueryError): { name: string; code?: unknown } {
  const cause: unknown = error.cause;
  if (!(cause instanceof Error)) return { name: error.name };
  const code = "code" in cause ? cause.code : undefined;
  return { name: cause.name, code };
}

function hasFailedQuery(error: Error, depth: number): boolean {
  if (depth > LOG_SCRUB.maxDepth) return false;
  if (error instanceof DrizzleQueryError) return true;
  if (error instanceof AggregateError && error.errors.some((item) => isQueryIn(item, depth + 1))) {
    return true;
  }
  return isQueryIn(error.cause, depth + 1);
}

function isQueryIn(value: unknown, depth: number): boolean {
  return value instanceof Error && hasFailedQuery(value, depth);
}

function scrub(value: unknown, depth: number): unknown {
  if (typeof value === "string") return value.replace(FAILED_QUERY, "Failed query: [scrubbed]");
  if (!(value instanceof Error) || depth > LOG_SCRUB.maxDepth) return value;
  if (value instanceof DrizzleQueryError) return scrubQuery(value);
  if (!hasFailedQuery(value, depth)) return value;
  // An error wrapping a failed query may repeat its text in its own message; keep only names.
  return {
    name: value.name,
    cause: scrub(value.cause, depth + 1),
    ...(value instanceof AggregateError
      ? { errors: value.errors.map((item: unknown) => scrub(item, depth + 1)) }
      : {}),
  };
}

// A failed query carries the SQL and its parameters (search text, user ids, emails), and
// Postgres messages can echo a parameter too ('invalid input syntax for type uuid: "…"').
// Logs keep only the error class and SQLSTATE code, which is enough to find the cause.
export function loggableError(error: unknown): unknown {
  return scrub(error, 0);
}

type ScrubbableConsole = {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

// Next prints an uncaught server-action error whole, so a call site that forgot loggableError
// would still leak a failed insert's email and password hash (#76). Every argument goes through it.
export function scrubConsole(target: ScrubbableConsole): void {
  const marked = target as ScrubbableConsole & { [SCRUBBED]?: true };
  if (marked[SCRUBBED]) return;
  for (const method of ["error", "warn"] as const) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(...args.map(loggableError));
  }
  marked[SCRUBBED] = true;
}
