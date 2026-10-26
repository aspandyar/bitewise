"use client";

import { useSyncExternalStore } from "react";
import { ru } from "@/lib/i18n/ru";
import { installHint } from "@/lib/pwa/install";
import { getInstallPrompt, promptInstall, subscribeInstallPrompt } from "@/lib/pwa/install-prompt";

type Device = { standalone: boolean; userAgent: string; maxTouchPoints: number };

// None of these change while the page is open, so one read is the snapshot for good.
let cachedDevice: Device | null = null;

function readDevice(): Device {
  cachedDevice ??= {
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  };
  return cachedDevice;
}

const noSubscription = () => () => undefined;

export function InstallRow() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  // The server snapshot is null, so hydration renders nothing and the hint appears right after.
  const device = useSyncExternalStore(noSubscription, readDevice, () => null);
  if (!device) return null;
  const hint = installHint({ ...device, canPrompt: prompt !== null });
  if (hint === "prompt") {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="flex min-h-11 items-center text-left text-accent-text underline"
      >
        {ru.install.button}
      </button>
    );
  }
  if (hint === "ios") {
    return (
      <div className="flex min-h-11 flex-col justify-center py-2">
        <p>{ru.install.iosTitle}</p>
        <p className="text-sm text-foreground/60">{ru.install.iosHint}</p>
      </div>
    );
  }
  return null;
}
