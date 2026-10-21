import { expect, it } from "vitest";
import { appearanceScript, themeColorViewport } from "@/lib/appearance";
import { offlineIcon, pwaIconUrl } from "./icons";
import { ru } from "@/lib/i18n/ru";
import { offlinePageHtml } from "./offline-page";

it("is a self-contained Russian page that retries the same address", () => {
  const html = offlinePageHtml();
  expect(html.startsWith("<!doctype html>")).toBe(true);
  expect(html).toContain('<html lang="ru">');
  expect(html).toContain(ru.offline.title);
  expect(html).toContain(ru.offline.retry);
  // An empty href reloads the address the worker answered for, without inline handlers.
  expect(html).toContain('<a href="">');
  expect(html).toContain(appearanceScript());
  expect(html).not.toMatch(/src=/);
});

it("colors the status bar and shows the app icon the worker keeps offline (#96)", () => {
  const html = offlinePageHtml();
  for (const { media, color } of themeColorViewport()) {
    expect(html).toContain(`<meta name="theme-color" media="${media}" content="${color}">`);
  }
  const links = [...html.matchAll(/<link [^>]*href="([^"]+)"/g)].map((match) => match[1]);
  expect(links).toEqual([pwaIconUrl(offlineIcon())]);
});
