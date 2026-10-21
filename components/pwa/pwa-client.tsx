"use client";

import { useEffect } from "react";
import { PWA } from "@/lib/config";
import { listenForInstallPrompt } from "@/lib/pwa/install-prompt";

export function PwaClient() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In dev every edit reloads modules; a worker answering navigations would only get in the way,
    // and one left by checking a production build on the same localhost port is removed (#98).
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((item) => item.unregister())))
        .catch(() => undefined);
      return;
    }
    navigator.serviceWorker
      .register(PWA.serviceWorkerPath, { scope: "/", updateViaCache: "none" })
      // Without a worker the app still works online; nothing to tell the user.
      .catch(() => undefined);
  }, []);
  useEffect(() => listenForInstallPrompt(window), []);
  return null;
}
