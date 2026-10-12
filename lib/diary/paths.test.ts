import { describe, expect, it } from "vitest";
import { addFoodHref, addHref, dayHref, diarySearch, editHref } from "./paths";

describe("diary paths", () => {
  it("links today to the home page and other days by query", () => {
    expect(dayHref("2026-10-11", "2026-10-11")).toBe("/");
    expect(dayHref("2026-10-09", "2026-10-11")).toBe("/?date=2026-10-09");
  });

  it("builds the add and edit links", () => {
    expect(diarySearch("2026-10-09", "lunch")).toBe("date=2026-10-09&meal=lunch");
    expect(addHref("2026-10-09", "lunch")).toBe("/diary/add?date=2026-10-09&meal=lunch");
    expect(editHref("abc")).toBe("/diary/entries/abc/edit");
  });
});

describe("addFoodHref", () => {
  it("opens the amount step for a food on a day and meal", () => {
    expect(addFoodHref("f1", "2026-10-12", "lunch")).toBe(
      "/diary/add/f1?date=2026-10-12&meal=lunch",
    );
  });
});
