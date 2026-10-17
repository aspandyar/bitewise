"use client";

import { useEffect } from "react";
import { PWA } from "@/lib/config";

export function PwaClient() {
  useEffect(() => {
    // In dev every edit reloads modules; a worker answering navigations would only get in the way.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(PWA.serviceWorkerPath, { scope: "/", updateViaCache: "none" })
      // Without a worker the app still works online; nothing to tell the user.
      .catch(() => undefined);
  }, []);
  return null;
}
