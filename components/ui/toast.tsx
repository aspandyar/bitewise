"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TOAST_DURATION_MS, TOAST_PARAM } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { parseToast, withoutToast, type Toast } from "@/lib/toast";

// The live region is always mounted: screen readers announce a change inside an existing
// region, not one that appears together with its text.
export function ToastHost() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = parseToast(params.get(TOAST_PARAM));
  const [shown, setShown] = useState<Toast | null>(null);

  // Taken out of the URL during render, so the toast outlives the parameter it came in.
  if (fromUrl !== null && fromUrl !== shown) setShown(fromUrl);

  // The parameter leaves the URL at once: leaving the page before the toast hides must not leave
  // a history entry that shows it again on Back.
  useEffect(() => {
    if (fromUrl === null) return;
    router.replace(withoutToast(pathname, new URLSearchParams(params)), { scroll: false });
  }, [fromUrl, pathname, params, router]);

  useEffect(() => {
    if (shown === null) return;
    const timer = setTimeout(() => setShown(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {shown ? (
        <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {ru.toasts[shown]}
        </p>
      ) : null}
    </div>
  );
}
