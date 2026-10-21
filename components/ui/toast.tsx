"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { undoAddAction } from "@/app/(app)/diary/actions";
import { QUICK, TOAST_DURATION_MS, TOAST_EVENT, TOAST_PARAM, UNDO_PARAM } from "@/lib/config";
import { parseUndoIds } from "@/lib/diary/quick";
import { ru } from "@/lib/i18n/ru";
import { parseToast, UNDOABLE_TOASTS, withoutToast, type Toast } from "@/lib/toast";

type Shown = { toast: Toast; undo: string[] | null; key: string };

// For a change that never leaves the page: a URL toast would mean a navigation, and its server
// render could arrive after a newer change.
export function showToast(toast: Toast): void {
  window.dispatchEvent(new CustomEvent<Toast>(TOAST_EVENT, { detail: toast }));
}

function message({ toast, undo }: Shown): string {
  // A repeat of a one-entry meal reads like any single add.
  if (toast === "addedMany" && (undo?.length ?? 0) > 1)
    return ru.toasts.addedMany(undo?.length ?? 0);
  if (toast === "addedMany") return ru.toasts.added;
  return ru.toasts[toast];
}

// The live region is always mounted: screen readers announce a change inside an existing
// region, not one that appears together with its text.
export function ToastHost() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = parseToast(params.get(TOAST_PARAM));
  const undoFromUrl = params.get(UNDO_PARAM);
  const [shown, setShown] = useState<Shown | null>(null);

  // Taken out of the URL during render, so the toast outlives the parameters it came in. The key
  // tells two identical toasts in a row apart (two quick adds of the same food).
  const key = `${fromUrl}:${undoFromUrl}`;
  if (fromUrl !== null && key !== shown?.key) {
    setShown({
      toast: fromUrl,
      undo: UNDOABLE_TOASTS.includes(fromUrl) ? parseUndoIds(undoFromUrl) : null,
      key,
    });
  }

  // The parameters leave the URL at once: leaving the page before the toast hides must not leave
  // a history entry that shows it again on Back.
  useEffect(() => {
    if (fromUrl === null) return;
    router.replace(withoutToast(pathname, new URLSearchParams(params)), { scroll: false });
  }, [fromUrl, pathname, params, router]);

  useEffect(() => {
    function onToast(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const toast = parseToast(String(event.detail));
      // A fresh key restarts the timer when the same toast is raised twice in a row.
      if (toast !== null) setShown({ toast, undo: null, key: `event:${Date.now()}` });
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (shown === null) return;
    // Long enough to notice a wrong tap when there is something to undo.
    const timer = setTimeout(() => setShown(null), shown.undo ? QUICK.undoMs : TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  function undo(ids: string[]) {
    setShown(null);
    startTransition(async () => {
      await undoAddAction(ids);
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {shown ? (
        <p className="flex items-center gap-3 rounded-full bg-accent py-1 pr-1 pl-4 text-sm font-medium text-on-accent shadow-lg ring-2 ring-background">
          <span className="py-1">{message(shown)}</span>
          {shown.undo ? (
            <button
              type="button"
              onClick={() => shown.undo && undo(shown.undo)}
              className="pointer-events-auto min-h-11 rounded-full px-4 underline focus-visible:outline-on-accent"
            >
              {ru.toasts.undo}
            </button>
          ) : (
            <span className="pr-3" />
          )}
        </p>
      ) : null}
    </div>
  );
}
