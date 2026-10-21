import { describe, expect, it } from "vitest";
import { ACCENTS, APPEARANCE } from "@/lib/config";
import {
  appearanceCookies,
  appearanceCss,
  appearanceScript,
  applyAppearance,
  contrastRatio,
  keepThemeColor,
  parseAppearance,
  readAppearanceCookie,
  syncThemeColor,
  themeColorFor,
} from "./appearance";

function runScript(cookie: string, metas: { media: string; content: string }[] = []) {
  const attrs: Record<string, string> = {};
  const listeners: (() => void)[] = [];
  const fakeDocument = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
    querySelectorAll: () =>
      metas.map((meta) => ({
        getAttribute: (name: string) => (name === "media" ? meta.media : null),
        setAttribute: (_name: string, value: string) => {
          meta.content = value;
        },
      })),
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
  };
  new Function("document", appearanceScript())(fakeDocument);
  for (const listener of listeners) listener();
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
    expect(readAppearanceCookie("tz=Asia/Almaty; bw-theme=light; bw-accent=blue")).toEqual({
      theme: "light",
      accent: "blue",
    });
  });

  it("takes the first of repeated names, like the head script does", () => {
    expect(readAppearanceCookie("bw-theme=dark; bw-theme=light")).toEqual({
      theme: "dark",
      accent: APPEARANCE.defaults.accent,
    });
  });

  it("ignores a name that only ends with the cookie name", () => {
    expect(readAppearanceCookie("xbw-theme=dark; theme=dark")).toEqual(APPEARANCE.defaults);
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
    expect(runScript("bw-theme=dark; bw-accent=green")).toEqual({
      "data-theme": "dark",
      "data-accent": "green",
    });
  });

  it("sets nothing for defaults and unknown or forged values", () => {
    expect(runScript("bw-theme=system; bw-accent=graphite")).toEqual({});
    expect(runScript('bw-theme=dark"><script>; bw-accent=red')).toEqual({});
    expect(runScript("xbw-theme=dark; theme=dark")).toEqual({});
    expect(runScript("")).toEqual({});
    expect(runScript("bw-theme=dark; bw-theme=light")).toEqual({ "data-theme": "dark" });
  });
});

describe("appearanceScript theme color", () => {
  const systemMetas = () => [
    { media: "(prefers-color-scheme: light)", content: APPEARANCE.base.light.background },
    { media: "(prefers-color-scheme: dark)", content: APPEARANCE.base.dark.background },
  ];

  it("gives a forced theme its status bar color before React hydrates (#97)", () => {
    const metas = systemMetas();
    runScript("bw-theme=dark", metas);
    expect(metas.map((meta) => meta.content)).toEqual([
      APPEARANCE.base.dark.background,
      APPEARANCE.base.dark.background,
    ]);
  });

  it("leaves the system metas alone without a forced theme", () => {
    const metas = systemMetas();
    runScript("bw-theme=system", metas);
    expect(metas).toEqual(systemMetas());
  });
});

describe("appearanceCookies", () => {
  const choice = { theme: "dark", accent: "green" } as const;

  it("writes both cookies for the whole site, readable by the head script", () => {
    const cookies = appearanceCookies(choice, { https: true });
    expect(cookies).toEqual([
      `${APPEARANCE.cookies.theme}=dark; path=/; max-age=${APPEARANCE.maxAgeSec}; samesite=lax; secure`,
      `${APPEARANCE.cookies.accent}=green; path=/; max-age=${APPEARANCE.maxAgeSec}; samesite=lax; secure`,
    ]);
  });

  it("drops Secure over plain http, where the browser would refuse the cookie", () => {
    for (const cookie of appearanceCookies(choice, { https: false })) {
      expect(cookie).not.toContain("secure");
    }
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

describe("keepThemeColor", () => {
  it("rewrites theme-color again whenever the head changes", () => {
    let content = "";
    let onMutation: () => void = () => undefined;
    const meta = {
      getAttribute: (name: string) => (name === "media" ? "(prefers-color-scheme: light)" : null),
      setAttribute: (_name: string, value: string) => {
        content = value;
      },
    };
    let disconnected = false;
    class FakeObserver {
      constructor(callback: () => void) {
        onMutation = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    }
    const doc = { head: {}, querySelectorAll: () => [meta] };
    const stop = keepThemeColor(doc, () => "dark", FakeObserver);
    expect(content).toBe(APPEARANCE.base.dark.background);
    // Next re-renders the viewport metas with server colors on every navigation.
    content = APPEARANCE.base.light.background;
    onMutation();
    expect(content).toBe(APPEARANCE.base.dark.background);
    stop();
    expect(disconnected).toBe(true);
  });
});
