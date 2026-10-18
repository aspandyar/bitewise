"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { undoAddAction } from "@/app/(app)/diary/actions";
import { QUICK, TOAST_DURATION_MS, TOAST_PARAM, UNDO_PARAM } from "@/lib/config";
import { parseUndoIds } from "@/lib/diary/quick";
import { ru } from "@/lib/i18n/ru";
import { parseToast, UNDOABLE_TOASTS, withoutToast, type Toast } from "@/lib/toast";

type Shown = { toast: Toast; undo: string[] | null; key: string };

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
              className="pointer-events-auto min-h-11 rounded-full px-4 underline"
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
