import { describe, expect, it } from "vitest";
import { makeProfileSchema } from "./schema";

const schema = makeProfileSchema("2026-10-09");
const valid = {
  sex: "female",
  birthDate: "1996-03-15",
  heightCm: "165",
  weightKg: "60,5",
  activityLevel: "light",
  goal: "lose",
};

describe("profile schema", () => {
  it("parses form strings into profile data", () => {
    expect(schema.parse(valid)).toEqual({ ...valid, heightCm: 165, weightKg: 60.5 });
  });

  it.each([
    ["sex", "other"],
    ["activityLevel", "extreme"],
    ["goal", ""],
    ["birthDate", "2026-02-30"],
    ["birthDate", "2027-01-01"],
    ["birthDate", "2013-10-10"], // 12 years old
    ["birthDate", "1925-01-01"], // 101 years old
    ["heightCm", "99"],
    ["weightKg", ""],
  ])("reports an error on %s = %j", (field, value) => {
    const result = schema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });

  it("accepts exactly 14 years old", () => {
    expect(schema.safeParse({ ...valid, birthDate: "2012-10-09" }).success).toBe(true);
  });
});
