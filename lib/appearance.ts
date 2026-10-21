import { z } from "zod";
import { ACCENTS, APPEARANCE, THEMES, type Accent, type ColorMode, type Theme } from "@/lib/config";

export type Appearance = { theme: Theme; accent: Accent };

export const themeSchema = z.enum(THEMES);
export const accentSchema = z.enum(ACCENTS);

// Cookies are client-controlled: anything outside the lists means "not chosen".
export function parseAppearance(raw: { theme?: string; accent?: string }): Appearance {
  const theme = themeSchema.safeParse(raw.theme);
  const accent = accentSchema.safeParse(raw.accent);
  return {
    theme: theme.success ? theme.data : APPEARANCE.defaults.theme,
    accent: accent.success ? accent.data : APPEARANCE.defaults.accent,
  };
}

// A repeated name (a cookie from a parent domain, another app on the same host) resolves to the
// first value everywhere: the head script, this reader and the appearance screen agree.
export function readAppearanceCookie(cookieHeader: string): Appearance {
  const values = new Map<string, string>();
  for (const item of cookieHeader.split(/;\s*/)) {
    const at = item.indexOf("=");
    const name = item.slice(0, at);
    if (at > 0 && !values.has(name)) values.set(name, item.slice(at + 1));
  }
  return parseAppearance({
    theme: values.get(APPEARANCE.cookies.theme),
    accent: values.get(APPEARANCE.cookies.accent),
  });
}

// WCAG 2.x relative luminance; the constants are the sRGB transfer curve from the standard.
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const NOT_LIGHT = ':root:not([data-theme="light"])';
const FORCED_DARK = ':root[data-theme="dark"]';
const otherAccents = ACCENTS.filter((accent) => accent !== APPEARANCE.defaults.accent);

function baseVars(mode: ColorMode): string {
  const { background, foreground } = APPEARANCE.base[mode];
  return `color-scheme:${mode};--background:${background};--foreground:${foreground};`;
}

function accentVars(accent: Accent, mode: ColorMode): string {
  const { accent: fill, onAccent } = APPEARANCE.accents[accent][mode];
  return `--accent:${fill};--on-accent:${onAccent};--accent-text:${fill};`;
}

function modeRules(root: string, mode: ColorMode): string {
  return [
    `${root}{${baseVars(mode)}${accentVars(APPEARANCE.defaults.accent, mode)}}`,
    ...otherAccents.map(
      (accent) => `${root}[data-accent="${accent}"]{${accentVars(accent, mode)}}`,
    ),
  ].join("");
}

// Order carries the cascade: system dark overrides light, a forced dark comes last, and an accent
// selector is one attribute more specific than its theme's base rule.
export function appearanceCss(): string {
  return `${modeRules(":root", "light")}@media (prefers-color-scheme: dark){${modeRules(NOT_LIGHT, "dark")}}${modeRules(FORCED_DARK, "dark")}`;
}

// Runs in <head> before the first paint (Next 16 "Preventing flash before hydration"): the root
// layout cannot read cookies without making every screen request-time under cacheComponents.
// Only listed values reach setAttribute, so a forged cookie cannot inject anything.
export function appearanceScript(): string {
  const themes = JSON.stringify(THEMES.filter((theme) => theme !== APPEARANCE.defaults.theme));
  const accents = JSON.stringify(otherAccents);
  const colors = JSON.stringify({
    light: APPEARANCE.base.light.background,
    dark: APPEARANCE.base.dark.background,
  });
  const { theme, accent } = APPEARANCE.cookies;
  // A forced theme also adds its own theme-color meta first in <head>, which wins over the
  // system-media ones: until keepThemeColor takes over after hydration, Android would paint the
  // system color in the status bar. The server metas are not rewritten here, since React matches
  // them by content when it hydrates and would add a rewritten one again.
  return `(function(){try{var d=document.documentElement,c="; "+document.cookie;function g(n){var p=c.split("; "+n+"=");return p.length>1?p[1].split(";")[0]:null}var t=g(${JSON.stringify(theme)}),a=g(${JSON.stringify(accent)}),k=${colors};if(${themes}.indexOf(t)>=0)d.setAttribute("data-theme",t);if(${accents}.indexOf(a)>=0)d.setAttribute("data-accent",a);if(k.hasOwnProperty(t)){var m=document.createElement("meta");m.setAttribute("name","theme-color");m.setAttribute("content",k[t]);m.setAttribute(${JSON.stringify(APPEARANCE.earlyThemeColorAttr)},"");document.head.prepend(m)}}catch(e){}})()`;
}

// Written by the browser, not a server action (#97): no round trip whose late answer could
// re-render the picker with an older choice, and Secure follows the page's own protocol, so a
// production build opened over http://192.168.x.x still remembers the choice.
export function appearanceCookies(
  { theme, accent }: Appearance,
  { https }: { https: boolean },
): string[] {
  const options = `; path=/; max-age=${APPEARANCE.maxAgeSec}; samesite=lax${https ? "; secure" : ""}`;
  return [`${APPEARANCE.cookies.theme}=${theme}${options}`, `${APPEARANCE.cookies.accent}=${accent}${options}`];
}

type AttributeTarget = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export function applyAppearance(root: AttributeTarget, { theme, accent }: Appearance): void {
  if (theme === APPEARANCE.defaults.theme) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (accent === APPEARANCE.defaults.accent) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

export function themeColorFor(theme: Theme, media: string): string {
  const mode: ColorMode = theme === "system" ? (media.includes("dark") ? "dark" : "light") : theme;
  return APPEARANCE.base[mode].background;
}

type MetaLike = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
};

// The phone's status bar takes theme-color; the metas carry system media queries, so a forced
// theme rewrites both to its own color. The head script's early meta has done its job by now.
export function syncThemeColor(
  doc: { querySelectorAll(selector: string): Iterable<MetaLike> },
  theme: Theme,
): void {
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
    if (meta.getAttribute(APPEARANCE.earlyThemeColorAttr) !== null) {
      meta.remove();
      continue;
    }
    meta.setAttribute("content", themeColorFor(theme, meta.getAttribute("media") ?? ""));
  }
}

type HeadObserver = {
  observe(target: object, options: { childList: boolean }): void;
  disconnect(): void;
};

// Next renders the viewport metas again (with system colors) on every navigation and server
// action, so a forced theme has to win again each time the head changes.
export function keepThemeColor(
  doc: { head: object; querySelectorAll(selector: string): Iterable<MetaLike> },
  readTheme: () => Theme,
  Observer: new (callback: () => void) => HeadObserver,
): () => void {
  syncThemeColor(doc, readTheme());
  const observer = new Observer(() => syncThemeColor(doc, readTheme()));
  observer.observe(doc.head, { childList: true });
  return () => observer.disconnect();
}

export function themeColorViewport(): { media: string; color: string }[] {
  return (["light", "dark"] as const).map((mode) => ({
    media: `(prefers-color-scheme: ${mode})`,
    color: APPEARANCE.base[mode].background,
  }));
}
