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

  it("keeps the database error code and message for diagnosis", () => {
    const error = new DrizzleQueryError("select 1", ["x"], pgError());
    expect(loggableError(error)).toMatchObject({
      code: "42P01",
      message: 'relation "foods" does not exist',
    });
  });

  it("passes other errors through untouched", () => {
    const error = new Error("boom");
    expect(loggableError(error)).toBe(error);
  });
});
