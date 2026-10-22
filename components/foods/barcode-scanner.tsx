"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SCANNER } from "@/lib/config";
import { expandUpcE, normalizeBarcode } from "@/lib/foods/barcode";
import { lookupBarcode, openCamera } from "@/lib/foods/camera";
import { newFoodForCode, shouldSubmitCode, type ScanTarget } from "@/lib/foods/scan";
import { ru } from "@/lib/i18n/ru";

type CameraState = "starting" | "on" | "denied" | "noCamera" | "insecure" | "loadFailed";
type Lookup =
  | { kind: "idle" }
  | { kind: "looking" }
  | { kind: "unavailable"; code: string }
  | { kind: "failed"; message: string };

const cameraMessages: Partial<Record<CameraState, string>> = {
  starting: ru.scanner.starting,
  denied: ru.scanner.denied,
  noCamera: ru.scanner.noCamera,
  insecure: ru.scanner.insecure,
  loadFailed: ru.scanner.loadFailed,
};

const failedMessages = {
  rate_limited: ru.foods.tooManyRequests,
  unauthorized: ru.scanner.signedOut,
  other: ru.scanner.failed,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function cameraErrorState(error: unknown): CameraState {
  return error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "noCamera";
}

// Full-screen layer over the search. Mounted only while open: closing it, leaving the screen,
// or cacheComponents hiding the screen unmounts it, and the cleanup turns the camera off.
export function BarcodeScanner({ target, onClose }: { target: ScanTarget; onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  // Aborted on unmount: an answer arriving after "Закрыть" or Back must not navigate.
  const lookupAbortRef = useRef<AbortController | null>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [manualError, setManualError] = useState<string | null>(null);
  // Read by the frame loop, which outlives renders: a lookup in flight pauses detection.
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; atMs: number } | null>(null);

  async function submit(code: string) {
    busyRef.current = true;
    setLookup({ kind: "looking" });
    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    const outcome = await lookupBarcode(code, target, { fetch, signal: controller.signal });
    switch (outcome.kind) {
      case "aborted":
        return;
      case "navigate":
        // Closed first: the screen stays cached, and Back must not reopen the camera.
        onClose();
        router.push(outcome.href);
        return;
      case "unavailable":
        setLookup({ kind: "unavailable", code: outcome.code });
        return;
      case "failed":
        setLookup({ kind: "failed", message: failedMessages[outcome.reason] });
    }
  }

  function scanAgain() {
    lastCodeRef.current = null;
    busyRef.current = false;
    setLookup({ kind: "idle" });
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("code") ?? "");
    const code = normalizeBarcode(raw);
    if (!code) {
      setManualError(ru.errors.barcode);
      return;
    }
    setManualError(null);
    void submit(code);
  }

  // Listeners and cleanups outlive renders; they call whatever onClose is current.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
    const close = () => onCloseRef.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      // aria-modal alone does not stop Tab from reaching the page underneath.
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    // The camera must not keep running behind a locked phone or another app.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      lookupAbortRef.current?.abort();
    };
  }, []);

  // Without a camera the digits field is the only way in.
  useEffect(() => {
    if (camera !== "starting" && camera !== "on") manualRef.current?.focus();
  }, [camera]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      if (!window.isSecureContext) return setCamera("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setCamera("noCamera");
      try {
        stream = await openCamera(
          (constraints) => navigator.mediaDevices.getUserMedia(constraints),
          () => stopped,
        );
      } catch (error) {
        if (!stopped) setCamera(cameraErrorState(error));
        return;
      }
      // Closed while the permission prompt was up: openCamera already stopped the late stream.
      if (!stream) return;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      let detector: {
        detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
      };
      try {
        // Loaded on open only: no other screen pays for the decoder.
        const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
        await prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) =>
              path.endsWith(".wasm") ? `${SCANNER.wasmPath}${path}` : prefix + path,
          },
          fireImmediately: true,
        });
        detector = new BarcodeDetector({ formats: [...SCANNER.formats] });
      } catch {
        if (!stopped) setCamera("loadFailed");
        return;
      }
      if (stopped) return;
      setCamera("on");

      const tick = async () => {
        if (stopped) return;
        if (!busyRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const [found] = await detector.detect(video).catch(() => []);
          const raw = found?.format === "upc_e" ? expandUpcE(found.rawValue) : found?.rawValue;
          const code = raw ? normalizeBarcode(raw) : null;
          const now = Date.now();
          if (
            code &&
            !stopped &&
            !busyRef.current &&
            shouldSubmitCode(lastCodeRef.current, code, now)
          ) {
            lastCodeRef.current = { code, atMs: now };
            void submit(code);
          }
        }
        timer = setTimeout(tick, SCANNER.frameIntervalMs);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // submit reads target and router at call time; restarting the camera for them is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cameraMessage = cameraMessages[camera];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={ru.scanner.title}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{ru.scanner.title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 font-medium underline text-accent-text"
          >
            {ru.scanner.close}
          </button>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          {/* playsInline: without it iOS opens the stream in its own full-screen player. */}
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {camera === "on" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-lg border-2 border-white/80"
            />
          ) : null}
          {cameraMessage ? (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
              {cameraMessage}
            </p>
          ) : null}
        </div>
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          {lookup.kind === "looking" ? <p className="text-sm">{ru.scanner.looking}</p> : null}
          {lookup.kind === "unavailable" ? (
            <>
              <p className="text-sm">{ru.scanner.unavailable}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={newFoodForCode(lookup.code, target)}
                  onClick={onClose}
                  className="flex min-h-11 items-center rounded-lg bg-accent px-4 font-medium text-on-accent"
                >
                  {ru.scanner.createFood}
                </Link>
                <button
                  type="button"
                  onClick={scanAgain}
                  className="min-h-11 rounded-lg border border-foreground/40 px-4 font-medium"
                >
                  {ru.scanner.scanAgain}
                </button>
              </div>
            </>
          ) : null}
          {lookup.kind === "failed" ? (
            <>
              <p className="text-sm text-red-600 dark:text-red-400">{lookup.message}</p>
              <button
                type="button"
                onClick={scanAgain}
                className="min-h-11 w-fit rounded-lg border border-foreground/40 px-4 font-medium"
              >
                {ru.scanner.scanAgain}
              </button>
            </>
          ) : null}
        </div>
        <form onSubmit={onManualSubmit} noValidate className="flex flex-col gap-1">
          <label htmlFor="barcode-manual" className="text-sm font-medium">
            {ru.scanner.manualLabel}
          </label>
          <div className="flex gap-2">
            <input
              ref={manualRef}
              id="barcode-manual"
              name="code"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              aria-invalid={manualError ? true : undefined}
              aria-describedby={manualError ? "barcode-manual-error" : undefined}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-foreground/40 bg-background px-3 text-base aria-invalid:border-red-600 dark:aria-invalid:border-red-400"
            />
            <button
              type="submit"
              disabled={lookup.kind === "looking"}
              className="min-h-11 rounded-lg bg-accent px-4 font-medium text-on-accent disabled:opacity-60"
            >
              {ru.scanner.find}
            </button>
          </div>
          {manualError ? (
            <p id="barcode-manual-error" className="text-sm text-red-600 dark:text-red-400">
              {manualError}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
