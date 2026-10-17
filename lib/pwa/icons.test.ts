import { expect, it } from "vitest";
import { pwaIcons, pwaIconUrl } from "./icons";

it("lists an any and a maskable icon per size", () => {
  expect(pwaIcons().map((icon) => icon.file)).toEqual([
    "any-192.png",
    "maskable-192.png",
    "any-512.png",
    "maskable-512.png",
  ]);
  expect(pwaIconUrl(pwaIcons()[0]!)).toBe("/pwa-icons/any-192.png");
});
