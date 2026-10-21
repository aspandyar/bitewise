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

type FakeMeta = { attrs: Record<string, string> };

function runScript(cookie: string) {
  const attrs: Record<string, string> = {};
  const prepended: FakeMeta[] = [];
  const fakeDocument = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
    createElement: () => {
      const meta: FakeMeta & { setAttribute(name: string, value: string): void } = {
        attrs: {},
        setAttribute(name, value) {
          meta.attrs[name] = value;
        },
      };
      return meta;
    },
    head: { prepend: (meta: FakeMeta) => prepended.push(meta) },
  };
  new Function("document", appearanceScript())(fakeDocument);
  return Object.assign(attrs, { prepended });
}

function attrsOf(result: ReturnType<typeof runScript>) {
  return Object.fromEntries(Object.entries(result).filter(([key]) => key !== "prepended"));
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
    expect(attrsOf(runScript("bw-theme=dark; bw-accent=green"))).toEqual({
      "data-theme": "dark",
      "data-accent": "green",
    });
  });

  it("sets nothing for defaults and unknown or forged values", () => {
    expect(attrsOf(runScript("bw-theme=system; bw-accent=graphite"))).toEqual({});
    expect(attrsOf(runScript('bw-theme=dark"><script>; bw-accent=red'))).toEqual({});
    expect(attrsOf(runScript("xbw-theme=dark; theme=dark"))).toEqual({});
    expect(attrsOf(runScript(""))).toEqual({});
    expect(attrsOf(runScript("bw-theme=dark; bw-theme=light"))).toEqual({ "data-theme": "dark" });
  });
});

describe("appearanceScript theme color", () => {
  // The server metas stay as rendered: React matches them by content when it hydrates, and a
  // rewritten one would be added a second time (#97 review).
  it("puts its own status bar color first for a forced theme", () => {
    const { prepended } = runScript("bw-theme=dark");
    expect(prepended.map((meta) => meta.attrs)).toEqual([
      {
        name: "theme-color",
        content: APPEARANCE.base.dark.background,
        [APPEARANCE.earlyThemeColorAttr]: "",
      },
    ]);
  });

  it("adds nothing without a forced theme", () => {
    expect(runScript("bw-theme=system").prepended).toEqual([]);
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
        remove: () => undefined,
      };
    });
    syncThemeColor({ querySelectorAll: () => metas }, "dark");
    expect(metas.map((meta) => meta.attrs.content)).toEqual([
      APPEARANCE.base.dark.background,
      APPEARANCE.base.dark.background,
    ]);
  });
});

describe("syncThemeColor and the early meta", () => {
  it("removes the head script's meta once React owns the head", () => {
    let removed = false;
    const early = {
      getAttribute: (name: string) => (name === APPEARANCE.earlyThemeColorAttr ? "" : null),
      setAttribute: () => undefined,
      remove: () => {
        removed = true;
      },
    };
    syncThemeColor({ querySelectorAll: () => [early] }, "system");
    expect(removed).toBe(true);
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
      remove: () => undefined,
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
