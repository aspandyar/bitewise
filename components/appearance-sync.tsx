"use client";

import { useLayoutEffect } from "react";
import { applyAppearance, readAppearanceCookie, syncThemeColor } from "@/lib/appearance";

// In dev, Strict Mode remounts <html> and drops the attributes the head script set; this puts them
// back before paint. It also points the status bar color at a forced theme. A no-op otherwise.
export function AppearanceSync() {
  useLayoutEffect(() => {
    const appearance = readAppearanceCookie(document.cookie);
    applyAppearance(document.documentElement, appearance);
    syncThemeColor(document, appearance.theme);
  }, []);
  return null;
}
