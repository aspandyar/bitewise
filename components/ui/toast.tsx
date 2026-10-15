"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { TOAST_DURATION_MS, TOAST_PARAM } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { parseToast, withoutToast } from "@/lib/toast";

// The live region is always mounted: screen readers announce a change inside an existing
// region, not one that appears together with its text.
export function ToastHost() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = parseToast(params.get(TOAST_PARAM));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => router.replace(withoutToast(pathname, new URLSearchParams(params)), { scroll: false }),
      TOAST_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [toast, pathname, params, router]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {toast ? (
        <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {ru.toasts[toast]}
        </p>
      ) : null}
    </div>
  );
}
