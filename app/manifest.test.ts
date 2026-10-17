import { expect, it } from "vitest";
import { PWA } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import manifest from "./manifest";

it("describes an installable standalone app", () => {
  const m = manifest();
  expect(m).toMatchObject({
    name: ru.app.name,
    short_name: ru.app.name,
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: PWA.brandColor,
  });
  expect(m.icons).toContainEqual({
    src: "/pwa-icons/maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  });
  expect(m.icons).toContainEqual({
    src: "/pwa-icons/any-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  });
});
