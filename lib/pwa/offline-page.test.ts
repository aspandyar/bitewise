import { expect, it } from "vitest";
import { appearanceScript } from "@/lib/appearance";
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
  expect(html).not.toMatch(/<link|src=/);
});
