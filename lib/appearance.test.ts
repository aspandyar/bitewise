import { describe, expect, it } from "vitest";
import { ACCENTS, APPEARANCE } from "@/lib/config";
import {
  appearanceCss,
  appearanceSchema,
  appearanceScript,
  applyAppearance,
  contrastRatio,
  parseAppearance,
  readAppearanceCookie,
  syncThemeColor,
  themeColorFor,
} from "./appearance";

function runScript(cookie: string) {
  const attrs: Record<string, string> = {};
  const fakeDocument = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
  };
  new Function("document", appearanceScript())(fakeDocument);
  return attrs;
}

describe("parseAppearance", () => {
  it("keeps known values", () => {
    expect(parseAppearance({ theme: "dark", accent: "green" })).toEqual({
      theme: "dark",
      accent: "green",
    });
  });

  it("falls back to defaults for unknown or missing values", () => {
    expect(parseAppearance({ theme: "neon", accent: "red" })).toEqual(APPEARANCE.defaults);
    expect(parseAppearance({})).toEqual(APPEARANCE.defaults);
  });
});

describe("readAppearanceCookie", () => {
  it("reads both cookies among others", () => {
    expect(readAppearanceCookie("tz=Asia/Almaty; theme=light; accent=blue")).toEqual({
      theme: "light",
      accent: "blue",
    });
  });

  it("ignores a name that only ends with the cookie name", () => {
    expect(readAppearanceCookie("xtheme=dark")).toEqual(APPEARANCE.defaults);
  });
});

describe("appearanceSchema", () => {
  it("rejects values outside the lists", () => {
    expect(appearanceSchema.safeParse({ theme: "dark", accent: "red" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ theme: "<b>", accent: "green" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ theme: "light", accent: "pink" }).success).toBe(true);
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference pairs", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("holds every accent to the minimum in both themes", () => {
    for (const accent of ACCENTS) {
      for (const mode of ["light", "dark"] as const) {
        const { accent: fill, onAccent } = APPEARANCE.accents[accent][mode];
        const page = APPEARANCE.base[mode].background;
        expect(contrastRatio(onAccent, fill), `${accent}/${mode} button`).toBeGreaterThanOrEqual(
          APPEARANCE.minContrast,
        );
        expect(contrastRatio(fill, page), `${accent}/${mode} link`).toBeGreaterThanOrEqual(
          APPEARANCE.minContrast,
        );
      }
    }
  });
});

describe("appearanceScript", () => {
  it("sets known theme and accent", () => {
    expect(runScript("theme=dark; accent=green")).toEqual({
      "data-theme": "dark",
      "data-accent": "green",
    });
  });

  it("sets nothing for defaults and unknown or forged values", () => {
    expect(runScript("theme=system; accent=graphite")).toEqual({});
    expect(runScript('theme=dark"><script>; accent=red')).toEqual({});
    expect(runScript("xtheme=dark")).toEqual({});
    expect(runScript("")).toEqual({});
  });
});

describe("appearanceCss", () => {
  it("lets a chosen theme beat the system one: forced dark rules come after the media block", () => {
    const css = appearanceCss();
    const media = css.indexOf("@media (prefers-color-scheme: dark)");
    expect(media).toBeGreaterThan(css.indexOf(':root[data-accent="green"]'));
    expect(css.indexOf(':root[data-theme="dark"][data-accent="green"]')).toBeGreaterThan(media);
    expect(css).toContain(':root:not([data-theme="light"])[data-accent="green"]');
  });
});

describe("applyAppearance", () => {
  it("removes attributes for defaults and sets the rest", () => {
    const attrs = new Map<string, string>([["data-theme", "dark"]]);
    const root = {
      setAttribute: (name: string, value: string) => void attrs.set(name, value),
      removeAttribute: (name: string) => void attrs.delete(name),
    };
    applyAppearance(root, { theme: "system", accent: "violet" });
    expect(Object.fromEntries(attrs)).toEqual({ "data-accent": "violet" });
  });
});

describe("theme color", () => {
  it("follows each meta's media for the system theme and the choice otherwise", () => {
    expect(themeColorFor("system", "(prefers-color-scheme: dark)")).toBe(
      APPEARANCE.base.dark.background,
    );
    expect(themeColorFor("light", "(prefers-color-scheme: dark)")).toBe(
      APPEARANCE.base.light.background,
    );
  });

  it("rewrites every theme-color meta", () => {
    const metas = ["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"].map((media) => {
      const attrs: Record<string, string> = { media };
      return {
        attrs,
        getAttribute: (name: string) => attrs[name] ?? null,
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
      };
    });
    syncThemeColor({ querySelectorAll: () => metas }, "dark");
    expect(metas.map((meta) => meta.attrs.content)).toEqual([
      APPEARANCE.base.dark.background,
      APPEARANCE.base.dark.background,
    ]);
  });
});
