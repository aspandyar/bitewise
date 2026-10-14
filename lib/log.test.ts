import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";
import { loggableError } from "./log";

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
