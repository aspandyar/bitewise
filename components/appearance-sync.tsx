"use client";

import { useLayoutEffect } from "react";
import { applyAppearance, keepThemeColor, readAppearanceCookie } from "@/lib/appearance";

// In dev, Strict Mode remounts <html> and drops the attributes the head script set; this puts them
// back before paint. It also keeps the status bar color on a forced theme across navigations.
export function AppearanceSync() {
  useLayoutEffect(() => {
    applyAppearance(document.documentElement, readAppearanceCookie(document.cookie));
    // The cookie is read on every change: the appearance screen rewrites it while mounted.
    return keepThemeColor(
      document,
      () => readAppearanceCookie(document.cookie).theme,
      MutationObserver,
    );
  }, []);
  return null;
}
