"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScanTarget } from "@/lib/foods/scan";
import { ru } from "@/lib/i18n/ru";
import { BarcodeScanner } from "./barcode-scanner";

export function ScanButton({ target }: { target: ScanTarget }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // cacheComponents hides a screen left by Back with its state and runs effect cleanups;
  // reopened, it must show the search, not the camera. Here and not in the scanner: this effect
  // starts with the layer closed, so StrictMode's extra cleanup on mount changes nothing.
  useEffect(() => close, [close]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ru.scanner.open}
        title={ru.scanner.open}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-foreground/40"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3" strokeLinecap="round" />
          <path d="M7 8v8M10 8v8M13 8v8M17 8v8" />
        </svg>
      </button>
      {open ? <BarcodeScanner target={target} onClose={close} /> : null}
    </>
  );
}
