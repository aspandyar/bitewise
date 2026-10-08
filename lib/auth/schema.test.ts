import { describe, expect, it } from "vitest";
import { credentialsSchema } from "./schema";

describe("credentialsSchema", () => {
  it("normalizes the email", () => {
    expect(credentialsSchema.parse({ email: "  Me@Mail.com ", password: "12345678" }).email).toBe(
      "me@mail.com",
    );
  });

  it.each([
    { email: "not-an-email", password: "12345678" },
    { email: "me@mail.com", password: "1234567" },
    { email: "me@mail.com", password: "x".repeat(129) },
    {},
  ])("rejects %j", (input) => {
    expect(credentialsSchema.safeParse(input).success).toBe(false);
  });
});
