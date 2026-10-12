import { describe, expect, it } from "vitest";
import { recipeFormSchema } from "./schema";

describe("recipeFormSchema", () => {
  it("parses a full form with a decimal comma", () => {
    expect(
      recipeFormSchema.parse({ name: "  Борщ ", cookedWeightG: "3000,5", servings: "10" }),
    ).toEqual({ name: "Борщ", cookedWeightG: 3000.5, servings: 10 });
  });

  it("treats empty weight and servings as not set", () => {
    expect(recipeFormSchema.parse({ name: "Салат", cookedWeightG: "", servings: " " })).toEqual({
      name: "Салат",
      cookedWeightG: null,
      servings: null,
    });
  });

  it("rounds the weight to stored precision", () => {
    expect(
      recipeFormSchema.parse({ name: "Каша", cookedWeightG: "500,555", servings: "" }),
    ).toMatchObject({ cookedWeightG: 500.56 });
  });

  it.each([
    [{ name: " ", cookedWeightG: "", servings: "" }, "name"],
    [{ name: "Борщ", cookedWeightG: "0", servings: "" }, "cookedWeightG"],
    [{ name: "Борщ", cookedWeightG: "20001", servings: "" }, "cookedWeightG"],
    [{ name: "Борщ", cookedWeightG: "", servings: "0" }, "servings"],
    [{ name: "Борщ", cookedWeightG: "", servings: "101" }, "servings"],
    [{ name: "Борщ", cookedWeightG: "", servings: "2,5" }, "servings"],
  ])("rejects %o at %s", (input, field) => {
    const result = recipeFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(field);
  });
});
