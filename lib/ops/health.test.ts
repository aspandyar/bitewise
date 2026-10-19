import { describe, expect, it } from "vitest";
import { handleHealth } from "./health";

describe("handleHealth", () => {
  it("is ok when the database answers", async () => {
    expect(await handleHealth(async () => undefined, 50)).toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  it("is unavailable when the database fails", async () => {
    const result = await handleHealth(async () => {
      throw new Error("connection refused at db:5432");
    }, 50);
    // No error text: the endpoint is public.
    expect(result).toEqual({ status: 503, body: { ok: false } });
  });

  it("is unavailable when the database hangs past the timeout", async () => {
    const hang = () => new Promise<void>(() => undefined);
    expect(await handleHealth(hang, 20)).toEqual({ status: 503, body: { ok: false } });
  });
});
