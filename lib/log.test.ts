import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";
import { loggableError, scrubConsole } from "./log";

function pgError(): Error {
  return Object.assign(new Error('relation "foods" does not exist'), { code: "42P01" });
}

describe("loggableError", () => {
  it("drops the query text and parameters of a failed query", () => {
    const error = new DrizzleQueryError(
      'select * from "foods" where name like $1 and owner_id = $2',
      ["гречка%", "user-123"],
      pgError(),
    );
    const logged = JSON.stringify(loggableError(error));
    expect(logged).not.toContain("гречка");
    expect(logged).not.toContain("user-123");
    expect(logged).not.toContain("select");
  });

  it("keeps the database error code for diagnosis", () => {
    const error = new DrizzleQueryError("select 1", ["x"], pgError());
    expect(loggableError(error)).toMatchObject({ code: "42P01" });
  });

  it("drops the database message, which can echo a parameter", () => {
    const cause = Object.assign(new Error('invalid input syntax for type uuid: "secret-id"'), {
      code: "22P02",
    });
    const error = new DrizzleQueryError("select $1", ["secret-id"], cause);
    expect(JSON.stringify(loggableError(error))).not.toContain("secret-id");
  });

  it("passes other errors through untouched", () => {
    const error = new Error("boom");
    expect(loggableError(error)).toBe(error);
  });
});

describe("loggableError inside other errors", () => {
  const failed = () => new DrizzleQueryError("insert into users", ["a@b.c", "scrypt$hash"], pgError());

  it("scrubs a failed query found in the cause chain", () => {
    const outer = new Error("action failed", { cause: failed() });
    const logged = JSON.stringify(loggableError(outer));
    expect(logged).not.toContain("a@b.c");
    expect(logged).toContain("42P01");
  });

  it("scrubs each error of an AggregateError", () => {
    const logged = JSON.stringify(loggableError(new AggregateError([failed()], "many")));
    expect(logged).not.toContain("scrypt$hash");
    expect(logged).toContain("42P01");
  });

  it("scrubs a stack or message string that carries a failed query", () => {
    const logged = String(loggableError(failed().stack));
    expect(logged).not.toContain("a@b.c");
    expect(logged).toContain("Failed query");
  });

  it("leaves ordinary strings alone", () => {
    expect(loggableError("request done")).toBe("request done");
  });
});

describe("scrubConsole", () => {
  it("passes every argument of error and warn through loggableError", () => {
    const seen: unknown[][] = [];
    const target = {
      error: (...args: unknown[]) => seen.push(args),
      warn: (...args: unknown[]) => seen.push(args),
    };
    scrubConsole(target);
    const error = new DrizzleQueryError("insert into users", ["a@b.c"], pgError());
    target.error("⨯", error);
    target.warn(error);
    expect(JSON.stringify(seen)).not.toContain("a@b.c");
    expect(seen[0]?.[0]).toBe("⨯");
  });

  it("wraps a console only once", () => {
    const calls: unknown[] = [];
    const target = { error: (...args: unknown[]) => calls.push(args), warn: () => undefined };
    scrubConsole(target);
    const once = target.error;
    scrubConsole(target);
    expect(target.error).toBe(once);
  });
});

describe("a failed query from another copy of drizzle", () => {
  // The production build bundles drizzle into several chunks, each with its own class, so the
  // error a page throws is not an instance of the class lib/log imported.
  class OtherCopyQueryError extends Error {
    constructor(
      readonly query: string,
      readonly params: unknown[],
      cause: unknown,
    ) {
      super(`Failed query: ${query}\nparams: ${params}`, { cause });
    }
  }

  it("is recognised by its shape and scrubbed", () => {
    const error = new OtherCopyQueryError("select $1", ["user-123"], pgError());
    const logged = JSON.stringify(loggableError(error));
    expect(logged).not.toContain("user-123");
    expect(logged).toContain("42P01");
  });
});

describe("errors the scrubber cannot fully walk or that drizzle did not wrap", () => {
  it("drops a chain deeper than it follows instead of passing it through", () => {
    let error: Error = new DrizzleQueryError("insert into users", ["deep@mail.com"], pgError());
    for (let level = 0; level < 10; level += 1) error = new Error("wrapped", { cause: error });
    expect(JSON.stringify(loggableError(error))).not.toContain("deep@mail.com");
    expect(loggableError(error)).not.toBe(error);
  });

  it("keeps only the code of a raw Postgres error, whose detail can echo a value", () => {
    const raw = Object.assign(new Error("duplicate key value violates unique constraint"), {
      name: "PostgresError",
      code: "23505",
      severity: "ERROR",
      detail: "Key (email)=(a@b.c) already exists.",
    });
    const logged = JSON.stringify(loggableError(raw));
    expect(logged).not.toContain("a@b.c");
    expect(logged).toContain("23505");
  });
});
