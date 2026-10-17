import { z } from "zod";
import { ACCENTS, APPEARANCE, THEMES, type Accent, type ColorMode, type Theme } from "@/lib/config";

export type Appearance = { theme: Theme; accent: Accent };

export const themeSchema = z.enum(THEMES);
export const accentSchema = z.enum(ACCENTS);
export const appearanceSchema = z.object({ theme: themeSchema, accent: accentSchema });

// Cookies are client-controlled: anything outside the lists means "not chosen".
export function parseAppearance(raw: { theme?: string; accent?: string }): Appearance {
  const theme = themeSchema.safeParse(raw.theme);
  const accent = accentSchema.safeParse(raw.accent);
  return {
    theme: theme.success ? theme.data : APPEARANCE.defaults.theme,
    accent: accent.success ? accent.data : APPEARANCE.defaults.accent,
  };
}

export function readAppearanceCookie(documentCookie: string): Appearance {
  const values = new Map(
    documentCookie.split("; ").map((item) => {
      const at = item.indexOf("=");
      return [item.slice(0, at), item.slice(at + 1)] as const;
    }),
  );
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
  const { theme, accent } = APPEARANCE.cookies;
  return `(function(){try{var d=document.documentElement,c="; "+document.cookie;function g(n){var p=c.split("; "+n+"=");return p.length>1?p[1].split(";")[0]:null}var t=g(${JSON.stringify(theme)}),a=g(${JSON.stringify(accent)});if(${themes}.indexOf(t)>=0)d.setAttribute("data-theme",t);if(${accents}.indexOf(a)>=0)d.setAttribute("data-accent",a)}catch(e){}})()`;
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
};

// The phone's status bar takes theme-color; the metas carry system media queries, so a forced
// theme rewrites both to its own color.
export function syncThemeColor(
  doc: { querySelectorAll(selector: string): Iterable<MetaLike> },
  theme: Theme,
): void {
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", themeColorFor(theme, meta.getAttribute("media") ?? ""));
  }
}

export function themeColorViewport(): { media: string; color: string }[] {
  return (["light", "dark"] as const).map((mode) => ({
    media: `(prefers-color-scheme: ${mode})`,
    color: APPEARANCE.base[mode].background,
  }));
}
