"use client";

import { useState, type CSSProperties } from "react";
import { showToast } from "@/components/ui/toast";
import {
  appearanceCookies,
  applyAppearance,
  syncThemeColor,
  type Appearance,
} from "@/lib/appearance";
import { ACCENTS, APPEARANCE, THEMES } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";

const tileClass =
  "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-foreground/40 px-2 py-2 text-center has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:font-medium has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-text";

// Each swatch shows its own shade for the current theme, so it carries both as CSS variables.
function swatchStyle(accent: (typeof ACCENTS)[number]): CSSProperties {
  const { light, dark } = APPEARANCE.accents[accent];
  return {
    "--swatch-light": light.accent,
    "--swatch-dark": dark.accent,
    "--swatch-on-light": light.onAccent,
    "--swatch-on-dark": dark.onAccent,
  } as CSSProperties;
}

function saveCookies(next: Appearance) {
  for (const cookie of appearanceCookies(next, { https: window.location.protocol === "https:" })) {
    document.cookie = cookie;
  }
}

export function AppearancePicker({ initial }: { initial: Appearance }) {
  const [value, setValue] = useState(initial);

  // The page recolors at once; the cookie is only what the next visit starts from. Nothing goes
  // to the server, so fast taps cannot be undone by a late answer (#97).
  function choose(next: Appearance) {
    setValue(next);
    applyAppearance(document.documentElement, next);
    syncThemeColor(document, next.theme);
    saveCookies(next);
    showToast("saved");
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{ru.appearance.theme}</legend>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((theme) => (
            <label key={theme} className={tileClass}>
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={value.theme === theme}
                onChange={() => choose({ ...value, theme })}
                className="sr-only"
              />
              <span className="text-base">{ru.appearance.themes[theme]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{ru.appearance.accent}</legend>
        <div className="grid grid-cols-3 gap-2">
          {ACCENTS.map((accent) => (
            <label key={accent} className={tileClass}>
              <input
                type="radio"
                name="accent"
                value={accent}
                checked={value.accent === accent}
                onChange={() => choose({ ...value, accent })}
                className="sr-only"
              />
              <span
                aria-hidden
                style={swatchStyle(accent)}
                className="flex size-8 items-center justify-center rounded-full bg-(--swatch-light) text-(--swatch-on-light) dark:bg-(--swatch-dark) dark:text-(--swatch-on-dark)"
              >
                {value.accent === accent ? ru.appearance.checkMark : null}
              </span>
              <span className="text-sm">{ru.appearance.accents[accent]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
