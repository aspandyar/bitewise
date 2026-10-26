import { describe, expect, it } from "vitest";
import { PWA } from "@/lib/config";
import { installHint, installPromptScript, isIos } from "./install";
import { getInstallPrompt, listenForInstallPrompt } from "./install-prompt";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

describe("isIos", () => {
  it("knows an iPhone and an iPad that asks for the desktop site", () => {
    expect(isIos(IPHONE, 5)).toBe(true);
    expect(isIos(IPAD_DESKTOP, 5)).toBe(true);
    expect(isIos(IPAD_DESKTOP, 0)).toBe(false);
    expect(isIos(ANDROID, 5)).toBe(false);
  });
});

describe("installHint", () => {
  it("shows nothing once opened from the home screen", () => {
    expect(
      installHint({ standalone: true, canPrompt: true, userAgent: ANDROID, maxTouchPoints: 5 }),
    ).toBeNull();
  });

  it("offers the system dialog when the browser has one", () => {
    expect(
      installHint({ standalone: false, canPrompt: true, userAgent: ANDROID, maxTouchPoints: 5 }),
    ).toBe("prompt");
  });

  it("explains the Share menu on iOS", () => {
    expect(
      installHint({ standalone: false, canPrompt: false, userAgent: IPHONE, maxTouchPoints: 5 }),
    ).toBe("ios");
  });

  it("stays silent where installing is not possible", () => {
    expect(
      installHint({ standalone: false, canPrompt: false, userAgent: ANDROID, maxTouchPoints: 5 }),
    ).toBeNull();
  });
});

type FakeWindow = Record<string, unknown> & {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(): void;
  fire(type: string, event: Event): void;
};

function fakeWindow(): FakeWindow {
  const listeners = new Map<string, ((event: Event) => void)[]>();
  return {
    addEventListener: (type, listener) =>
      listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: () => undefined,
    fire: (type, event) => listeners.get(type)?.forEach((listener) => listener(event)),
  };
}

describe("install prompt before hydration", () => {
  it("the head script keeps an early prompt event and stops the browser's own bar", () => {
    const win = fakeWindow();
    new Function("window", installPromptScript())(win);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    win.fire("beforeinstallprompt", event);
    expect(event.defaultPrevented).toBe(true);
    expect(win[PWA.installPromptGlobal]).toBe(event);
  });

  it("the store picks up an event caught before it started listening", () => {
    const win = fakeWindow();
    const early = Object.assign(new Event("beforeinstallprompt"), {
      prompt: async () => undefined,
    });
    win[PWA.installPromptGlobal] = early;
    const stop = listenForInstallPrompt(win as unknown as Window);
    expect(getInstallPrompt()).toBe(early);
    expect(win[PWA.installPromptGlobal]).toBeUndefined();
    stop();
  });
});
